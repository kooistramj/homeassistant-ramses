import eventlet
eventlet.monkey_patch()  # Dit MOET als eerste gebeuren!

import paho.mqtt.client as mqtt
import json
import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO

# Flask Applicatie
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# MQTT Instellingen
MQTT_BROKER = "192.168.1.44"
MQTT_PORT = 1883
MQTT_USERNAME = "mqtt"
MQTT_PASSWORD = "mqtt"
MQTT_TOPIC = "RAMSES/GATEWAY/#"

received_messages = []
APPROVED_DEVICES_FILE = "/opt/ramses_mqtt/approved_devices.json"

# **Laad goedgekeurde apparaten**
approved_devices = {}
if os.path.exists(APPROVED_DEVICES_FILE):
    try:
        with open(APPROVED_DEVICES_FILE, "r") as file:
            approved_devices = json.load(file)
    except (json.JSONDecodeError, FileNotFoundError):
        approved_devices = {}

def save_approved_devices():
    """Sla goedgekeurde apparaten op binnen een Flask-appcontext."""
    with app.app_context():
        try:
            with open(APPROVED_DEVICES_FILE, "w") as file:
                json.dump(approved_devices, file)
        except Exception as e:
            print(f"[ERROR] Kan JSON-bestand niet opslaan: {e}")

# **MQTT Callbacks**
def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f"[MQTT] Connected to MQTT Broker with code {reason_code}")
    if reason_code == 0:
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"[ERROR] Failed to connect: {reason_code}")

def on_message(client, userdata, msg):
    """Berichten ontvangen via MQTT en doorsturen via WebSocket."""
    global received_messages
    try:
        payload = json.loads(msg.payload.decode())
        print(f"[MQTT] Ontvangen bericht: {payload}")
        received_messages.append(payload)

        # Houd maximaal 50 berichten
        if len(received_messages) > 50:
            received_messages = received_messages[-50:]

        # Stuur het bericht via WebSocket
        socketio.emit("mqtt_message", payload)

    except Exception as e:
        print(f"[ERROR] Algemene fout bij verwerken van MQTT-bericht: {e}")

# **MQTT Client Instellen**
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

print("[MQTT] Connecting to MQTT Broker...")
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

# **Flask API Routes**
@app.route("/messages")
def get_messages():
    return jsonify(received_messages)

@app.route("/approved_devices", methods=["GET"])
def get_approved_devices():
    return jsonify(approved_devices)

@app.route("/approved_devices", methods=["POST"])
def add_approved_device():
    global approved_devices
    data = request.json
    device_id = data.get("device_id")
    friendly_name = data.get("friendly_name")

    if device_id and friendly_name:
        approved_devices[device_id] = friendly_name
        save_approved_devices()
        return jsonify({"status": "success"}), 200

    return jsonify({"status": "error", "message": "Invalid data"}), 400

@app.route("/approved_devices/<device_id>", methods=["DELETE"])
def delete_approved_device(device_id):
    global approved_devices

    if device_id in approved_devices:
        del approved_devices[device_id]
        save_approved_devices()
        return jsonify({"status": "success"}), 200

    return jsonify({"status": "error", "message": "Apparaat niet gevonden"}), 404

# **WebSocket Events**
@socketio.on("connect")
def handle_connect():
    print("[WebSocket] Client verbonden")

@socketio.on("disconnect")
def handle_disconnect():
    print("[WebSocket] Client verbroken")

if __name__ == "__main__":
    print("[MQTT] Flask-SocketIO server start op poort 5000...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
