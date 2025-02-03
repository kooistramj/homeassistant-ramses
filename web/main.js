const socket = io(`http://${window.location.hostname}:8080`);

document.addEventListener("DOMContentLoaded", function () {
    loadApprovedDevices();
    showTab("approved");
    setupDarkMode();
});

// Tabs wisselen
function showTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelector(`.tab[onclick="showTab('${tabName}')"]`).classList.add("active");

    if (tabName === "approved") {
        loadApprovedDevices();
    }
}

// ** Donkere modus instellen **
function setupDarkMode() {
    const darkModeToggle = document.getElementById("darkModeToggle");
    if (localStorage.getItem("darkMode") === "enabled") {
        document.body.classList.add("dark-mode");
        darkModeToggle.checked = true;
    }

    darkModeToggle.addEventListener("change", () => {
        if (darkModeToggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "disabled");
        }
    });
}

// ** Laad goedgekeurde apparaten **
function loadApprovedDevices() {
    axios.get("/approved_devices")
        .then(response => {
            const approvedDevicesTable = document.getElementById("approvedDevicesTable");
            approvedDevicesTable.innerHTML = "";
            Object.entries(response.data).forEach(([id, name]) => {
                const row = `
                    <tr>
                        <td>${name}</td>
                        <td><span class="tooltip-target" data-tooltip="${name}">${id}</span></td>
                        <td style="text-align: right;">
                            <button class="rename-btn" onclick="renameDevice('${id}')">Naam wijzigen</button>
                            <button class="delete-btn" onclick="deleteDevice('${id}')">Verwijderen</button>
                        </td>
                    </tr>`;
                approvedDevicesTable.innerHTML += row;
            });
            filterDebugMessages();
            setupTooltips();
        })
        .catch(error => console.error("Fout bij laden goedgekeurde apparaten:", error));
}

// ** MQTT berichten ontvangen **
socket.on("mqtt_message", (data) => {
    const debugTable = document.getElementById("debugTable");

    let msgParts = data.msg.split(/\s+/);
    let length = msgParts[0] || "N/A";
    let type = msgParts[1] || "N/A";
    let rq_rp_w = msgParts[2] || "---";
    let sender = msgParts[3] || "---";
    let receiver = msgParts[4] || "---";
    let ref = msgParts[5] || "---";
    let code = msgParts[6] || "N/A";
    let dataSize = msgParts[7] || "N/A";
    let payload = msgParts.slice(8).join(" ") || "Geen data";

    if (payload.length > 20) {
        payload = payload.match(/.{1,20}/g).join("<br>");
    }

    let tijd = "---";
    try {
        tijd = new Date(data.ts).toLocaleString();
    } catch (e) {
        console.error("Tijd parsing fout:", e);
    }

    axios.get("/approved_devices").then(response => {
        let approvedDevices = response.data;
        let isApproved = approvedDevices.hasOwnProperty(sender) || approvedDevices.hasOwnProperty(receiver);

        const row = `
            <tr class="${isApproved ? 'approved-device' : ''}">
                <td>${length}</td>
                <td>${type}</td>
                <td>${rq_rp_w}</td>
                <td><span class="tooltip-target" data-tooltip="${approvedDevices[sender] || sender}">${sender}</span></td>
                <td><span class="tooltip-target" data-tooltip="${approvedDevices[receiver] || receiver}">${receiver}</span></td>
                <td>${ref}</td>
                <td>${code}</td>
                <td>${dataSize}</td>
                <td class="payload">${payload}</td>
                <td>${tijd}</td>
                <td style="text-align: right;">
                    <button class="approve-btn" onclick="approveDevice('${sender}')">Selecteren</button>
                </td>
            </tr>`;

        debugTable.innerHTML = row + debugTable.innerHTML;
        filterDebugMessages();
        setupTooltips();
    }).catch(error => console.error("Fout bij ophalen goedgekeurde apparaten:", error));
});

// ** Tooltips instellen **
function setupTooltips() {
    document.querySelectorAll(".tooltip-target").forEach(element => {
        element.addEventListener("mouseover", function (event) {
            const tooltip = document.getElementById("tooltip");
            tooltip.innerText = element.dataset.tooltip;
            tooltip.style.left = `${event.pageX + 10}px`;
            tooltip.style.top = `${event.pageY + 10}px`;
            tooltip.style.display = "block";
        });

        element.addEventListener("mouseout", function () {
            document.getElementById("tooltip").style.display = "none";
        });
    });
}

// ** Apparaat goedkeuren **
function approveDevice(deviceId) {
    const friendlyName = prompt("Voer een naam in voor het apparaat:");
    if (friendlyName) {
        axios.post("/approved_devices", { device_id: deviceId, friendly_name: friendlyName })
            .then(() => loadApprovedDevices())
            .catch(error => console.error("Fout bij opslaan apparaat:", error));
    }
}

// ** Naam wijzigen **
function renameDevice(deviceId) {
    const newName = prompt("Voer een nieuwe naam in:");
    if (newName) {
        axios.post("/approved_devices", { device_id: deviceId, friendly_name: newName })
            .then(() => loadApprovedDevices())
            .catch(error => console.error("Fout bij wijzigen apparaat:", error));
    }
}

// ** Apparaat verwijderen **
function deleteDevice(deviceId) {
    if (confirm("Weet je zeker dat je dit apparaat wilt verwijderen?")) {
        axios.delete(`/approved_devices/${deviceId}`)
            .then(() => loadApprovedDevices())
            .catch(error => console.error("Fout bij verwijderen apparaat:", error));
    }
}

// ** Handmatig een apparaat toevoegen **
function addDevice() {
    const name = document.getElementById("deviceNameInput").value.trim();
    const id = document.getElementById("deviceIdInput").value.trim();

    if (name && id) {
        axios.post("/approved_devices", { device_id: id, friendly_name: name })
            .then(() => {
                loadApprovedDevices();
                document.getElementById("deviceNameInput").value = "";
                document.getElementById("deviceIdInput").value = "";
            })
            .catch(error => console.error("Fout bij handmatig toevoegen apparaat:", error));
    } else {
        alert("Voer zowel een naam als een ID in.");
    }
}

// ** Filteren van debug berichten **
function filterDebugMessages() {
    const filterVan = document.getElementById("filterVan").value.toLowerCase();
    const filterNaar = document.getElementById("filterNaar").value.toLowerCase();
    const filterCode = document.getElementById("filterCode").value.toLowerCase();
    const filterApprovedOnly = document.getElementById("filterApprovedOnly").checked;

    axios.get("/approved_devices").then(response => {
        let approvedDevices = response.data;
        document.querySelectorAll("#debugTable tr").forEach(row => {
            let columns = row.getElementsByTagName("td");
            let van = columns[3]?.innerText.toLowerCase() || "";
            let naar = columns[4]?.innerText.toLowerCase() || "";
            let code = columns[6]?.innerText.toLowerCase() || "";
            let isApproved = approvedDevices.hasOwnProperty(van) || approvedDevices.hasOwnProperty(naar);

            let matchApproved = !filterApprovedOnly || isApproved;
            let match = van.includes(filterVan) && naar.includes(filterNaar) && code.includes(filterCode) && matchApproved;

            row.style.display = match ? "" : "none";
        });
    }).catch(error => console.error("Fout bij ophalen goedgekeurde apparaten:", error));
}
