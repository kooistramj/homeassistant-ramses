#!/bin/bash

# Start Nginx
service nginx start

# Start de Python MQTT app
python3 /app/mqtt_app.py
