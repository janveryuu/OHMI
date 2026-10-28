param(
    [string]$ToolchainRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex/toolchains'),
    [string]$BuildRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex/build/ohmi-electronics-4d9cb37')
)
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$vendor = Join-Path $repository 'third_party/design-electronics'
$source = Join-Path $vendor 'upstream'
$lock = Get-Content (Join-Path $vendor 'lock.json') -Raw | ConvertFrom-Json
$sdk = Join-Path $ToolchainRoot 'emsdk'
$sdl = Join-Path $ToolchainRoot 'ohmi-sdl/SDL'
$ttf = Join-Path $ToolchainRoot 'ohmi-sdl/SDL_ttf'
$cmake = Join-Path $ToolchainRoot 'ohmi-build-tools/cmake/data/bin/cmake.exe'
$ninja = Join-Path $ToolchainRoot 'ohmi-build-tools/bin/ninja.exe'
foreach ($item in @(@($sdl, $lock.sdl), @($ttf, $lock.sdlTtf), @($sdk, $lock.emsdkCommit))) {
    $actual = & git -C $item[0] rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $actual -ne $item[1]) { throw "Pinned dependency mismatch: $($item[0])" }
}
foreach ($property in $lock.submodules.psobject.Properties) {
    $actual = & git -C (Join-Path $ttf $property.Name) rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $actual -ne $property.Value) { throw "Pinned submodule mismatch: $($property.Name)" }
}
if (!(Test-Path $cmake) -or !(Test-Path $ninja)) { throw 'Install the pinned CMake/Ninja wheels into toolchains/ohmi-build-tools; see third_party/design-electronics/README.md.' }
$env:PROCESSOR_ARCHITECTURE = 'AMD64'
$env:EM_CONFIG = Join-Path $sdk '.emscripten'
$env:EMSDK_PYTHON = Join-Path $sdk 'python/3.13.3_64bit/python.exe'
$env:EMSDK_NODE = Join-Path $sdk 'node/24.19.0_64bit/node.exe'
$env:PATH = "$(Split-Path $cmake);$(Split-Path $ninja);$(Join-Path $sdk 'upstream/emscripten');$env:PATH"
$version = & $env:EMSDK_PYTHON (Join-Path $sdk 'upstream/emscripten/emcc.py') --version
if ($LASTEXITCODE -ne 0 -or ($version -join ' ') -notmatch '5\.0\.7') { throw 'Emscripten 5.0.7 must be activated in the pinned SDK checkout.' }
& $env:EMSDK_PYTHON (Join-Path $sdk 'upstream/emscripten/emcmake.py') $cmake -S $source -B $BuildRoot -G Ninja "-DCMAKE_MAKE_PROGRAM=$ninja" -DCMAKE_BUILD_TYPE=Release "-DDE_SDL_SOURCE=$sdl" "-DDE_SDLTTF_SOURCE=$ttf"
if ($LASTEXITCODE -ne 0) { throw 'Engine configuration failed.' }
& $cmake --build $BuildRoot --parallel 4
if ($LASTEXITCODE -ne 0) { throw 'Engine build failed.' }
$destination = Join-Path $repository 'web-app/public/vendor/design-electronics'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$artifacts = @()
$patches = @()
foreach ($name in @('CMakeLists.txt', 'src/web.cpp', 'src/ohmi_web.cpp', 'src/panels.cpp')) {
    $patches += [ordered]@{ file = $name; sha256 = (Get-FileHash (Join-Path $source $name) -Algorithm SHA256).Hash.ToLower() }
}
foreach ($name in @('designElectronics.js', 'designElectronics.wasm', 'designElectronics.data')) {
    Copy-Item -LiteralPath (Join-Path $BuildRoot $name) -Destination $destination
    $file = Get-Item (Join-Path $destination $name)
    $artifacts += [ordered]@{ file = $name; bytes = $file.Length; sha256 = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower() }
}
$noticeSources = @(
    @('designElectronics (MIT)', (Join-Path $source 'LICENSE')),
    @('SDL3 (zlib)', (Join-Path $sdl 'LICENSE.txt')),
    @('SDL_ttf (zlib)', (Join-Path $ttf 'LICENSE.txt')),
    @('FreeType (FreeType License selected)', (Join-Path $ttf 'external/freetype/docs/FTL.TXT')),
    @('FreeType license overview', (Join-Path $ttf 'external/freetype/LICENSE.TXT')),
    @('dlg', (Join-Path $ttf 'external/freetype/subprojects/dlg/LICENSE')),
    @('HarfBuzz', (Join-Path $ttf 'external/harfbuzz/COPYING')),
    @('PlutoSVG', (Join-Path $ttf 'external/plutosvg/LICENSE')),
    @('PlutoVG (PlutoSVG submodule)', (Join-Path $ttf 'external/plutosvg/plutovg/LICENSE')),
    @('PlutoVG', (Join-Path $ttf 'external/plutovg/LICENSE')),
    @('Lato and Source Code Pro fonts (OFL 1.1)', (Join-Path $source 'assets/fonts/OFL.txt')),
    @('minih264 (CC0)', (Join-Path $source 'third_party/minih264/LICENSE')),
    @('minimp4 (CC0/public domain)', (Join-Path $source 'third_party/minimp4/LICENSE'))
)
$notices = "OHMI local electronics preview`nBased on designElectronics $($lock.commit), with OHMI browser/presentation changes.`nPortions of this software are copyright (C) The FreeType Project (www.freetype.org). All rights reserved.`nLato: Copyright (c) 2010-2011 by tyPoland Lukasz Dziedzic, with Reserved Font Name Lato. Licensed under SIL OFL 1.1 below.`n"
foreach ($item in $noticeSources) {
    $notices += "`n========== $($item[0]) ==========`n" + (Get-Content -LiteralPath $item[1] -Raw) + "`n"
}
[IO.File]::WriteAllText((Join-Path $destination 'THIRD-PARTY-NOTICES.txt'), $notices)
[ordered]@{ upstream = $lock.commit; emscripten = $lock.emscripten; protocol = 1; patchedSources = $patches; artifacts = $artifacts } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $destination 'engine-manifest.json')
Write-Output 'Pinned designElectronics WASM artifacts built and copied.'
