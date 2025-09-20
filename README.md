# AgroVision

Small static site and dashboard that reads CSV weather/crop data and shows simple irrigation recommendations.

Quick start
1. Ensure Python 3.8+ is installed.
2. (Optional) Convert Excel files to CSV if you have `.xlsx` files: see `convert_xlsx.py`.
3. Start a local server to test (PowerShell):

```powershell
py -3 -m http.server 8000
# then open http://localhost:8000/framoverview.html
```

Preparing for GitHub
- Create a repository named `agrovision` on GitHub.
- In this project folder run:

```powershell
git init
git add .
git commit -m "Initial commit - AgroVision dashboard"
# then add the remote and push (replace <your-remote> with the repo URL)
git remote add origin <your-remote>
git branch -M main
git push -u origin main
```

Notes
- The pages load CSV files directly from the repository. To preview them in a browser you must serve the files via HTTP (GitHub Pages or local server) — opening the HTML files via `file://` will block CSV loading in many browsers.
- If you want the site published, enable GitHub Pages in repository settings (use `main` branch, `/ (root)` folder).

CSV/Excel conversion
- Put your Excel file (e.g., `data.xlsx`) in the repo and run `python convert_xlsx.py data.xlsx` to create CSVs.
