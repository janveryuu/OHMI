param([string]$ContainerName = ('ohmi-m3-test-' + [guid]::NewGuid().ToString('N').Substring(0,8)))
$ErrorActionPreference='Stop'
if($ContainerName -notmatch '^ohmi-m3-test-[a-z0-9-]+$'){throw 'Use a dedicated M3 test container name.'}
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$image='public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4'
& docker run --detach --rm --name $ContainerName --network none -e POSTGRES_HOST_AUTH_METHOD=trust $image
if($LASTEXITCODE -ne 0){throw 'Could not create isolated PostgreSQL test container.'}
try {
  $ready=$false
  for($attempt=0;$attempt -lt 60;$attempt++){
    & docker exec $ContainerName pg_isready -U postgres *> $null
    if($LASTEXITCODE -eq 0 -and (& docker logs $ContainerName 2>&1 | Select-String -SimpleMatch 'PostgreSQL init process complete' -Quiet)){$ready=$true;break}
    Start-Sleep -Milliseconds 500
  }
  if(!$ready){throw 'Local PostgreSQL did not start.'}
  # Storage API is absent from this image; minimal inert tables let historical policies compile.
  @'
create schema if not exists storage;
grant usage,create on schema storage to postgres;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
'@ | & docker exec -i $ContainerName psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
  if($LASTEXITCODE -ne 0){throw 'Could not prepare inert Storage fixture tables.'}
  foreach($migration in (Get-ChildItem -LiteralPath (Join-Path $repository 'supabase/migrations') -Filter '*.sql' | Sort-Object Name)){
    Get-Content -LiteralPath $migration.FullName | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
    if($LASTEXITCODE -ne 0){throw "Database migration failed: $($migration.Name)"}
  }
  foreach($relative in @('supabase/tests/circuit_build.sql','supabase/tests/ai_reliability.sql')){
    Get-Content -LiteralPath (Join-Path $repository $relative) | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
    if($LASTEXITCODE -ne 0){throw "Database rehearsal failed: $relative"}
  }
}finally{& docker stop $ContainerName | Out-Null}
