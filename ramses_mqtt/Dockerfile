# Gebruik een lichtgewicht Python-image
FROM python:3.11-slim

# Install dependencies
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Maak werkomgeving
WORKDIR /app

# Kopieer de bestanden naar de container
COPY mqtt_app.py /app/mqtt_app.py
COPY web /app/web
COPY requirements.txt /app/requirements.txt
COPY run.sh /app/run.sh

# Installeer Python-dependencies
RUN pip install -r requirements.txt

# Maak run.sh uitvoerbaar
RUN chmod +x /app/run.sh

# Exposeer de poorten
EXPOSE 5000 8080

# Start de applicatie
CMD ["/app/run.sh"]
