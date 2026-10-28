param([string]$ContainerName = ('ohmi-m2-test-' + [guid]::NewGuid().ToString('N').Substring(0,8)))
$ErrorActionPreference='Stop'
if($ContainerName -notmatch '^ohmi-m2-test-[a-z0-9-]+$'){throw 'Use a dedicated M2 test container name.'}
$repository=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$image='public.ecr.aws/supabase/postgres@sha256:7374d196da7e301512cc5329e18040e0f7bb856287b323777cdadecccbc6c7e4'
& docker run --detach --rm --name $ContainerName --network none -e POSTGRES_HOST_AUTH_METHOD=trust $image
if($LASTEXITCODE -ne 0){throw 'Could not create isolated PostgreSQL test container.'}
try {
    $ready=$false
    for($attempt=0;$attempt -lt 40;$attempt++){
        & docker exec $ContainerName pg_isready -U postgres *> $null
        if($LASTEXITCODE -eq 0){
            # pg_isready also sees the temporary server while image migrations are still running.
            $initialized = (& docker logs $ContainerName 2>&1 | Select-String -SimpleMatch 'PostgreSQL init process complete' -Quiet)
            if($initialized){$ready=$true;break}
        }
        Start-Sleep -Milliseconds 500
    }
    if(!$ready){throw 'Local PostgreSQL did not start.'}
    foreach($relative in @('supabase/migrations/20261024152911_playground_projects.sql','supabase/migrations/20261028181546_electronics_projects.sql','supabase/tests/electronics_projects_rls.sql','supabase/tests/electronics_projects_rollback.sql')) {
        Get-Content -LiteralPath (Join-Path $repository $relative) | & docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1
        if($LASTEXITCODE -ne 0){throw "Database rehearsal failed: $relative"}
    }
} finally { & docker stop $ContainerName | Out-Null }
