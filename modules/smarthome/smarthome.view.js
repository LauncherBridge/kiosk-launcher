// SmartHome Rendering Engine

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    minimapCanvas: null,
    minimapCtx: null,

    activeRoom: null,
    activeGroup: null, // Gruppenfähig
    rooms: [],
    minimapRooms: [],

    // Zoom & Pan State
    scale: 1,
    targetScale: 1,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,

    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    // Highlight animation
    highlightAlpha: 0,
    targetHighlightAlpha: 0,

    animationFrame: null,

    init() {
        this.canvas = document.getElementById("smarthome-canvas");
        this.overlay = document.getElementById("smarthome-overlay");

        if (!this.canvas) {
            console.error("SmartHomeView: Canvas not found");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        // Mini‑Map
        this.minimapCanvas = document.getElementById("smarthome-minimap-canvas");
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext("2d");
        }

        this._resize();
        window.addEventListener("resize", () => this._resize());

        this._bindEvents();
        this._startRenderLoop();

        // Popup Close Button
        const closeBtn = document.getElementById("sh-popup-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.closePopup());
        }
        // Gruppen-Zurück-Button
        const backBtn = document.getElementById("sh-group-back");
        if (backBtn) {
            backBtn.addEventListener("click", () => {
                if (this.activeGroup) {
                    // zurück zum ersten Raum der Gruppe
                    const firstRoom = this.activeGroup.roomIds[0];
                    this._goToRoom(firstRoom);
                }
            });
        }
    },

    _resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

        if (this.minimapCanvas) {
            this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
            this.minimapCanvas.height = this.minimapCanvas.offsetHeight;
        }
    },

    _startRenderLoop() {
        const loop = () => {
            this._animate();
            this._drawMainView();
            this._drawMiniMap();
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    },

    _animate() {
        this.scale += (this.targetScale - this.scale) * 0.15;
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.15;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.15;
        this.highlightAlpha += (this.targetHighlightAlpha - this.highlightAlpha) * 0.15;
    },

    _bindEvents() {
        // -------------------------
        // Klick auf Haupt‑Canvas
        // -------------------------
        this.canvas.addEventListener("click", (ev) => {
            const rect = this.canvas.getBoundingClientRect();
            let x = ev.clientX - rect.left;
            let y = ev.clientY - rect.top;

            // Transformation rückgängig machen
            x = (x - this.offsetX) / this.scale;
            y = (y - this.offsetY) / this.scale;

            // Container-Klick
            for (const container of SmartHomeData.containers) {
                const dx = container.position.x;
                const dy = container.position.y;

                const dist = Math.hypot(x - dx, y - dy);
                if (dist < 20) {
                    SmartHomeView.openContainerPopup(container);
                    return;
                }
            }

            // Raum-Klick
            for (const room of SmartHomeData.rooms) {
                if (this._pointInPolygon({ x, y }, room.polygon)) {
                    this._goToRoom(room.id);
                    return;
                }
            }

            this.activeRoom = null;
            this.activeGroup = null;
            this.targetHighlightAlpha = 0;
        });

        // -------------------------
        // Klick auf Mini‑Map
        // -------------------------
        this.minimapCanvas.addEventListener("click", (ev) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;

            for (const r of this.minimapRooms) {
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this._goToRoom(r.id);
                    return;
                }
            }

            this.activeRoom = null;
            this.activeGroup = null;
            this.targetHighlightAlpha = 0;
        });

        // -------------------------
        // Zoom (Mausrad)
        // -------------------------
        this.canvas.addEventListener("wheel", (ev) => {
            ev.preventDefault();

            const zoomIntensity = 0.1;
            const oldScale = this.targetScale;

            if (ev.deltaY < 0) {
                this.targetScale *= (1 + zoomIntensity);
            } else {
                this.targetScale *= (1 - zoomIntensity);
            }

            this.targetScale = Math.max(0.3, Math.min(3, this.targetScale));

            const rect = this.canvas.getBoundingClientRect();
            const mx = ev.clientX - rect.left;
            const my = ev.clientY - rect.top;

            this.targetOffsetX = mx - (mx - this.targetOffsetX) * (this.targetScale / oldScale);
            this.targetOffsetY = my - (my - this.targetOffsetY) * (this.targetScale / oldScale);
        }, { passive: false });

        // -------------------------
        // Pan (ziehen)
        // -------------------------
        this.canvas.addEventListener("mousedown", (ev) => {
            this.isPanning = true;
            this.panStartX = ev.clientX - this.targetOffsetX;
            this.panStartY = ev.clientY - this.targetOffsetY;
        });

        window.addEventListener("mousemove", (ev) => {
            if (!this.isPanning) return;

            this.targetOffsetX = ev.clientX - this.panStartX;
            this.targetOffsetY = ev.clientY - this.panStartY;
        });

        window.addEventListener("mouseup", () => {
            this.isPanning = false;
        });
    },

    // ---------------------------------------------------------
    // 4.3.D – Gruppenfähige Navigation
    // ---------------------------------------------------------
_goToRoom(roomId) {
    const eff = SmartHomeGroups.getEffectiveGroupForRoom(roomId);

    // Einzelraum
    if (eff.type === "single") {
        this.activeRoom = roomId;
        this.activeGroup = null;
        this.targetHighlightAlpha = 1;

        document.getElementById("sh-group-header").classList.add("hidden");
        document.getElementById("sh-group-back").classList.add("hidden");
        return;
    }

    // Gruppe
    this.activeRoom = roomId; // aktiver Raum innerhalb der Gruppe
    this.activeGroup = {
        type: eff.type,
        id: eff.group.id,
        roomIds: [...eff.group.roomIds]
    };
    this.targetHighlightAlpha = 1;

    // Header anzeigen
    document.getElementById("sh-group-header").classList.remove("hidden");
    document.getElementById("sh-group-back").classList.remove("hidden");

    // Dynamischer Titel
    let groupTitle = eff.group.name;
    if (!groupTitle) {
        const roomNames = eff.group.roomIds
            .map(rid => SmartHomeData.getRoom(rid)?.name)
            .filter(Boolean);

        if (roomNames.length === 1) groupTitle = roomNames[0];
        else if (roomNames.length === 2) groupTitle = `${roomNames[0]} + ${roomNames[1]}`;
        else groupTitle = `${roomNames[0]} + ${roomNames.length - 1} weitere`;
    }
    document.getElementById("sh-group-title").textContent = groupTitle;

// Räume einfügen (Gruppiert nach Typ, eine Zeile pro Gruppe)
const roomsEl = document.getElementById("sh-group-rooms");
roomsEl.innerHTML = "";

// 1. Räume nach Typ gruppieren
const groupsByType = {};
eff.group.roomIds.forEach(rid => {
    const room = SmartHomeData.getRoom(rid);
    if (!room) return;

    const type = SmartHomeData.roomTypes[room.type]?.group || "Andere";

    if (!groupsByType[type]) groupsByType[type] = [];
    groupsByType[type].push(room);
});

// 2. Typ‑Gruppen alphabetisch sortieren
const sortedTypes = Object.keys(groupsByType).sort();

// 3. Innerhalb jeder Gruppe alphabetisch sortieren und eine Zeile erzeugen
sortedTypes.forEach(typeName => {
    const rooms = groupsByType[typeName].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    // Zeile erstellen
    const line = document.createElement("div");
    line.className = "sh-group-line";

    // Fett: Gruppenname
    const strong = document.createElement("strong");
    strong.textContent = typeName + " – ";
    line.appendChild(strong);

    // Räume kommasepariert
    rooms.forEach((room, index) => {
        const span = document.createElement("span");
        span.textContent = room.name;
        span.classList.add("sh-group-room-inline");

        if (room.id === this.activeRoom) {
            span.classList.add("active-room");
        }

        span.onclick = () => this._goToRoom(room.id);

        line.appendChild(span);

        if (index < rooms.length - 1) {
            const comma = document.createElement("span");
            comma.textContent = ", ";
            line.appendChild(comma);
        }
    });

    roomsEl.appendChild(line);
});



    // 4.3.F.11 – Leichter Zoom auf aktiven Raum
    if (this.activeRoom) {
        const room = SmartHomeData.getRoom(this.activeRoom);
        if (room) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            room.polygon.forEach(p => {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            });

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const zoomFactor = 1.15;
            this.targetScale *= zoomFactor;

            this.targetOffsetX = this.canvas.width / 2 - centerX * this.targetScale;
            this.targetOffsetY = this.canvas.height / 2 - centerY * this.targetScale;
        }
    }

    // 4.3.F.10 – Automatischer Gruppen-Zoom
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    eff.group.roomIds.forEach(rid => {
        const room = SmartHomeData.getRoom(rid);
        if (!room) return;

        room.polygon.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.targetOffsetX = this.canvas.width / 2 - centerX * this.scale;
    this.targetOffsetY = this.canvas.height / 2 - centerY * this.scale;

    const groupWidth = maxX - minX;
    const groupHeight = maxY - minY;

    const scaleX = this.canvas.width / (groupWidth * 1.4);
    const scaleY = this.canvas.height / (groupHeight * 1.4);

    this.targetScale = Math.min(scaleX, scaleY);
}

,

    // ---------------------------------------------------------
    // Haupt‑Rendering
    // ---------------------------------------------------------
    _drawMainView() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        this.rooms = SmartHomeData.rooms;

        const activeGroup = this.activeGroup ? this.activeGroup.roomIds : null;

        this.rooms.forEach(room => {
            const type = SmartHomeData.roomTypes[room.type];
            const fillColor = type?.color || "#444";

            const isInGroup = activeGroup && activeGroup.includes(room.id);

            // Highlight Einzelraum
            if (this.activeRoom === room.id) {
                ctx.fillStyle = `rgba(255, 184, 108, ${0.3 + this.highlightAlpha * 0.4})`;
            } else {
                ctx.fillStyle = fillColor;
            }

            // Raum zeichnen
            ctx.beginPath();
            ctx.moveTo(room.polygon[0].x, room.polygon[0].y);

            for (let i = 1; i < room.polygon.length; i++) {
                ctx.lineTo(room.polygon[i].x, room.polygon[i].y);
            }

            ctx.closePath();
            ctx.fill();

            // --- Gruppen‑Highlight ---
            if (isInGroup) {
                ctx.save();
                ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
                ctx.fill();
                ctx.restore();

                ctx.save();
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                ctx.stroke();
                ctx.restore();
            }

            // Label
            ctx.fillStyle = "var(--sh-text)";
            ctx.font = "20px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(room.name, room.polygon[0].x + 12, room.polygon[0].y + 12);

            // Icon (zentriert)
            if (type?.icon) {
                ctx.fillStyle = "var(--sh-text)";
                ctx.font = "28px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const cx = (room.polygon[0].x + room.polygon[2].x) / 2;
                const cy = (room.polygon[0].y + room.polygon[2].y) / 2;

                ctx.fillText(type.icon, cx, cy);
            }

            // Türen rendern
            room.doors?.forEach(door => {
                const d = door.position;
                ctx.fillStyle = "#FFD28A";
                ctx.beginPath();
                ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
                ctx.fill();
            });

            // Container rendern
            SmartHomeData.containers.forEach(container => {
                if (container.room !== room.id) return;

                const ctype = SmartHomeData.deviceTypes[container.type];
                const icon = ctype?.icon || "device_unknown";
                const color = ctype?.color || "#FFFFFF";

                const dx = container.position.x;
                const dy = container.position.y;

                ctx.fillStyle = color;
                ctx.font = "26px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(icon, dx, dy);

                ctx.fillStyle = "#FFFFFF";
                ctx.beginPath();
                ctx.arc(dx, dy + 18, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        });

        ctx.restore();
    },

    // ---------------------------------------------------------
    // Mini‑Map Rendering
    // ---------------------------------------------------------
    _drawMiniMap() {
        const ctx = this.minimapCtx;
        if (!ctx) return;

        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        this.minimapRooms = SmartHomeData.rooms.map(r => ({
            id: r.id,
            x: r.minimap.x,
            y: r.minimap.y,
            w: r.minimap.w,
            h: r.minimap.h,
            label: r.minimap.label,
            polygon: r.polygon,
            doors: r.doors,
            type: r.type
        }));

        const activeGroup = this.activeGroup ? this.activeGroup.roomIds : null;

        this.minimapRooms.forEach(r => {
            const type = SmartHomeData.roomTypes[r.type];
            const fillColor = type?.color || "#444";

            const isInGroup = activeGroup && activeGroup.includes(r.id);

            ctx.fillStyle = (this.activeRoom === r.id)
                ? `rgba(255, 184, 108, ${0.3 + this.highlightAlpha * 0.4})`
                : fillColor;

            ctx.fillRect(r.x, r.y, r.w, r.h);

            // Gruppen‑Highlight Mini‑Map
            if (isInGroup) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                ctx.fillRect(r.x, r.y, r.w, r.h);

                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 2;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
            }

            // Label
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(r.label, r.x + 5, r.y + 5);

            // Icon
            if (type?.icon) {
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "14px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;

                ctx.fillText(type.icon, cx, cy);
            }

            // Türen rendern (Mini‑Map)
            r.doors?.forEach(door => {
                const d = door.position;

                const scaleX = r.w / (r.polygon[1].x - r.polygon[0].x);
                const scaleY = r.h / (r.polygon[2].y - r.polygon[1].y);

                const mx = r.x + (d.x - r.polygon[0].x) * scaleX;
                const my = r.y + (d.y - r.polygon[0].y) * scaleY;

                ctx.fillStyle = "#FFD28A";
                ctx.fillRect(mx - 2, my - 2, 4, 4);
            });

            // Container rendern (Mini‑Map)
            SmartHomeData.containers.forEach(container => {
                if (container.room !== r.id) return;

                const ctype = SmartHomeData.deviceTypes[container.type];
                const icon = ctype?.icon || "device_unknown";
                const color = ctype?.color || "#FFFFFF";

                const scaleX = r.w / (r.polygon[1].x - r.polygon[0].x);
                const scaleY = r.h / (r.polygon[2].y - r.polygon[1].y);

                const mx = r.x + (container.position.x - r.polygon[0].x) * scaleX;
                const my = r.y + (container.position.y - r.polygon[0].y) * scaleY;

                ctx.fillStyle = color;
                ctx.font = "12px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(icon, mx, my);
            });
        });

        ctx.strokeStyle = "#FFFFFF55";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, w, h);
    },

    _pointInPolygon(point, vs) {
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

            if (intersect) inside = !inside;
        }
        return inside;
    },

    // ---------------------------------------------------------
    // 4.1 + 4.2 – Popup‑System + Status‑System
    // ---------------------------------------------------------

    openContainerPopup(container) {
        const popup = document.getElementById("smarthome-popup");
        const title = document.getElementById("sh-popup-title");
        const icon = document.getElementById("sh-popup-icon");


        const type = SmartHomeData.deviceTypes[container.type];

        title.textContent = container.name;
        icon.textContent = type?.icon || "device_unknown";

        // Tabs aktivieren
        document.querySelectorAll(".sh-popup-tabs button").forEach(btn => {
            btn.onclick = () => {
                this._renderPopupTab(container, btn.dataset.tab);
            };
        });

        // Standard-Tab
        this._renderPopupTab(container, "status");

        popup.classList.remove("hidden");
    },

    closePopup() {
        document.getElementById("smarthome-popup").classList.add("hidden");
    },

    // 4.2 – Status‑Rendering
    _renderPopupTab(container, tab) {
        const body = document.getElementById("sh-popup-body");

        if (tab === "status") {
            const s = container.state;

            body.innerHTML = `
                <div class="sh-status-block">
                    <div><strong>Status:</strong> ${s.reachable ? "Online" : "Offline"}</div>
                    <div><strong>Power:</strong> ${s.on ? "An" : "Aus"}</div>
                    <div><strong>Helligkeit:</strong> ${s.brightness}%</div>
                </div>

                <div class="sh-status-block">
                    <div><strong>Temperatur:</strong> ${s.sensor.temperature ?? "-"} °C</div>
                    <div><strong>Luftfeuchte:</strong> ${s.sensor.humidity ?? "-"} %</div>
                    <div><strong>Bewegung:</strong> ${s.sensor.motion ? "Ja" : "Nein"}</div>
                </div>
            `;
        }

        if (tab === "actions") {
            body.innerHTML = `<div>Aktionen kommen in 4.3</div>`;
        }

        if (tab === "history") {
            body.innerHTML = `<div>Historie kommt in 4.4</div>`;
        }

        if (tab === "devices") {
            body.innerHTML = `<div>Geräteverwaltung kommt in 5.x</div>`;
        }
    },

    // Live‑Update für spätere Geräteintegration
    updateContainerState(containerId, newState) {
        const c = SmartHomeData.getContainer(containerId);
        if (!c) return;

        Object.assign(c.state, newState);

        const popup = document.getElementById("smarthome-popup");
        if (!popup.classList.contains("hidden")) {
            this._renderPopupTab(c, "status");
        }
    }
};
