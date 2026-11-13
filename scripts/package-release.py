"""Create a reproducible, Netlify-ready static ZIP. No dependencies or credentials."""
from pathlib import Path
import hashlib
import sys
import zipfile

root=Path(__file__).resolve().parents[1]
output=Path(sys.argv[1]) if len(sys.argv)>1 else root/'release'/'DS-Market-Lab-0.2.0-Netlify.zip'
output.parent.mkdir(parents=True,exist_ok=True)
files=[p for p in (root/'dist').rglob('*') if p.is_file() and not p.name.startswith('_phone')]
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):
        info=zipfile.ZipInfo(p.relative_to(root/'dist').as_posix(),(2026,11,13,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
    info=zipfile.ZipInfo('DEPLOY-README.txt',(2026,11,13,0,0,0))
    info.compress_type=zipfile.ZIP_DEFLATED
    z.writestr(info,'DS Market Lab 0.2.0 — fictional paper-trading preview with Strategy Lab.\nUpload this ZIP to Netlify manually, or extract and deploy its contents.\nThis manual-deploy archive needs no build, API key, account, Mac runner, or database.\nGit-connected deployments should use the editable repository sources and netlify.toml instead.\nNo live data, AI forecasts, cloud sync, or real orders are connected.\nBrowser records are local to this device and URL; export important sessions and strategies.\nProduct icon / Home Screen install remains pending design approval.\n')
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    assert {'index.html','app.mjs','engine.mjs','styles.css','_headers'}<=set(z.namelist())
print(str(output))
print('SHA256 '+hashlib.sha256(output.read_bytes()).hexdigest())
