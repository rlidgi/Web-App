#!/bin/bash
cd /home/site/wwwroot
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
