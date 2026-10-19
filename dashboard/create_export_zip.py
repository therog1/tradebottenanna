#!/usr/bin/env python3
import os
import zipfile

def create_zip():
    zip_filename = "public/tradebottenanna-v2.3-export.zip"
    root_zip = "tradebottenanna-v2.3-export.zip"
    
    # Exclude heavy or temporary folders
    exclude_dirs = {
        'node_modules',
        '.git',
        '.aistudio',
        'dist',
        'build',
        '.cache',
        '.npm',
        '__pycache__'
    }
    
    exclude_files = {
        'tradebottenanna-v2.3-export.zip',
        '.DS_Store'
    }

    os.makedirs('public', exist_ok=True)
    
    count = 0
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to skip excluded directories, but KEEP .github
            dirs[:] = [d for d in dirs if d not in exclude_dirs and (not d.startswith('.') or d == '.github')]
            
            for file in files:
                if file in exclude_files or file.endswith('.zip'):
                    continue
                file_path = os.path.join(root, file)
                # Store relative path without leading ./
                arcname = os.path.relpath(file_path, '.')
                zipf.write(file_path, arcname)
                count += 1

    # Also copy to root for convenience
    import shutil
    shutil.copyfile(zip_filename, root_zip)
    
    size_kb = os.path.getsize(zip_filename) / 1024
    print(f"✓ ZIP created successfully: {zip_filename} ({count} files, {size_kb:.1f} KB)")
    print(f"✓ Also copied to: {root_zip}")

if __name__ == "__main__":
    create_zip()
