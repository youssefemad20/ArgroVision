#!/usr/bin/env python3
"""Simple Excel -> CSV converter.
Usage: python convert_xlsx.py input.xlsx [sheet_name]
Will write CSV files next to the input file for each sheet or the named sheet.
"""
import sys
from pathlib import Path
import pandas as pd

def convert(path: Path, sheet_name=None):
    if sheet_name:
        df = pd.read_excel(path, sheet_name=sheet_name)
        out = path.with_suffix(f'.{sheet_name}.csv')
        df.to_csv(out, index=False)
        print('Wrote', out)
    else:
        xl = pd.read_excel(path, sheet_name=None)
        for name, df in xl.items():
            out = path.with_suffix(f'.{name}.csv')
            df.to_csv(out, index=False)
            print('Wrote', out)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python convert_xlsx.py input.xlsx [sheet_name]')
        sys.exit(1)
    p = Path(sys.argv[1])
    sheet = sys.argv[2] if len(sys.argv) > 2 else None
    convert(p, sheet)
