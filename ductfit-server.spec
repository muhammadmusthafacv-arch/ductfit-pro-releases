# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

datas = [
    ('templates', 'templates'),
    ('static', 'static'),
    ('fittings_tree.json', '.'),
    ('ashrae_extracted', 'ashrae_extracted'),
    ('ashrae_data', 'ashrae_data'),
    ('version.json', '.'),
    ('package.json', '.'),
    ('projects.json', '.'),
    ('custom_templates.json', '.')
]

hiddenimports = [
    'flask',
    'numpy',
    'PIL',
    'PIL.Image',
    'reportlab',
    'reportlab.lib',
    'reportlab.platypus',
    'reportlab.pdfgen',
    'reportlab.lib.colors',
    'reportlab.lib.pagesizes',
    'reportlab.lib.styles',
    'reportlab.lib.units',
    'project_manager',
    'ashrae_engine',
    'ashrae_official_runner',
    'pdf_report_generator',
    'pdf_master_catalog',
    'version_manager'
]

a = Analysis(
    ['app.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ductfit-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon='build/icon.ico'
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='ductfit-server',
)
