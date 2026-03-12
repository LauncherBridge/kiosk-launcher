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

    // Floor‑Scroll‑State (für Snap‑Scrolling)
    floorScroll: {
        lastY: 0,
        lastTime: 0,
        velocity: 0,
        isTouching: false
    },

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

    // 3.0 – Navigations-Config
    nav: {
        minScale: 0.3,
        maxScale: 3,
        focusPadding: 80,   // px Rand um fokussierte Räume
        zoomLerp: 0.15,     // Zoom-Interpolation
        panLerp: 0.15       // Pan-Interpolation
    },

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
                    const firstRoom = this.activeGroup.roomIds[0];
                    this._goToRoom(firstRoom);
                }
            });
        }

        // 4.12 – Etagenliste initial rendern
        this.renderFloorList();
        this.bindFloorListEvents();

        // Wenn noch keine Etage aktiv ist → erste Etage setzen
        if (!this.activeFloor && SmartHomeData.floors.length > 0) {
            this.activeFloor = SmartHomeData.floors[0].id;
        }

        // Active‑State in der Liste setzen
        this.setActiveFloor(this.activeFloor);
    },

    // ---------------------------------------------------------
    // 4.12 – Etagenliste Rendering
    // ---------------------------------------------------------
    renderFloorList() {
        const el = document.getElementById("sh-floor-list");
        if (!el) return;

        const floors = SmartHomeData.floors;
        if (!floors || floors.length === 0) {
            el.innerHTML = "";
            return;
        }

        let html = "";

        floors.forEach(floor => {
            const status = SmartHomeData.getFloorStatus(floor.id);
            const name = SmartHomeData.getFloorDisplayName(floor.id);

            // Active‑Klasse setzen
            const activeClass = (this.activeFloor === floor.id) ? "active" : "";

            html += `
                <div class="sh-floor-item ${activeClass}" data-floor="${floor.id}">
                    <div class="sh-floor-status ${status}"></div>
                    <div class="sh-floor-name">${name}</div>
                </div>
            `;
        });

        el.innerHTML = html;
    },

    bindFloorListEvents() {
        const el = document.getElementById("sh-floor-list");
        if (!el) return;

        // ---------------------------------------------------------
        // Klick auf Etage
        // ---------------------------------------------------------
        el.addEventListener("click", (ev) => {
            const item = ev.target.closest(".sh-floor-item");
            if (!item) return;

            const floorId = Number(item.dataset.floor);
            this.setActiveFloor(floorId);
        });

        // ---------------------------------------------------------
        // Vorbereitung für Snap‑Scrolling
        // ---------------------------------------------------------
        const list = el;

        // --- START (Touch + Maus) ---
        const start = (y) => {
            this.floorScroll.lastY = y;
            this.floorScroll.lastTime = performance.now();
            this.floorScroll.velocity = 0;
            this.floorScroll.isTouching = true;
        };

        list.addEventListener("touchstart", (ev) => {
            start(ev.touches[0].clientY);
        });

        list.addEventListener("mousedown", (ev) => {
            start(ev.clientY);
        });

        // --- MOVE (Touch + Maus) ---
        const move = (y) => {
            if (!this.floorScroll.isTouching) return;

            const now = performance.now();
            const dy = y - this.floorScroll.lastY;
            const dt = now - this.floorScroll.lastTime;

            if (dt > 0) {
                this.floorScroll.velocity = dy / dt; // px/ms
            }

            this.floorScroll.lastY = y;
            this.floorScroll.lastTime = now;
        };

        list.addEventListener("touchmove", (ev) => {
            move(ev.touches[0].clientY);
        });

        window.addEventListener("mousemove", (ev) => {
            move(ev.clientY);
        });

        // --- END (Touch + Maus) ---
        const end = () => {
            if (!this.floorScroll.isTouching) return;
            this.floorScroll.isTouching = false;

            this.onFloorScrollEnd(); // später Snap‑Scrolling
        };

        list.addEventListener("touchend", end);
        window.addEventListener("mouseup", end);
    },

    setActiveFloor(floorId) {
        if (this.activeFloor === floorId) return;

        this.activeFloor = floorId;

        // 1) Active‑State in der Liste setzen
        document.querySelectorAll(".sh-floor-item").forEach(item => {
            item.classList.toggle("active", Number(item.dataset.floor) === floorId);
        });

        // 2) Scroll zur aktiven Etage
        this._scrollActiveFloorIntoView();

        // 3) Raum‑Reset
        this.activeRoom = null;

        // 4) Canvas‑Reset
        this.targetScale = 1;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        this.activeRoom = null;
        this.activeGroup = null;
        this.targetHighlightAlpha = 0;

        // Sanfter Übergang
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // 2.13.2 – Mini‑Map aktualisieren
        this.minimapRooms = [];

        // 5) Canvas‑Update kommt in Schritt 3.x
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
        const { zoomLerp, panLerp } = this.nav;

        this.scale += (this.targetScale - this.scale) * zoomLerp;
        this.offsetX += (this.targetOffsetX - this.offsetX) * panLerp;
        this.offsetY += (this.targetOffsetY - this.offsetY) * panLerp;
        this.highlightAlpha += (this.targetHighlightAlpha - this.highlightAlpha) * 0.15;
    },

    // 3.0 – Basis-Helfer für Raum-Fokus
    _getRoomBounds(room) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        room.polygon.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        return { minX, minY, maxX, maxY };
    },

    _computeFocusTransform(bounds) {
        const { minX, minY, maxX, maxY } = bounds;
        const padding = this.nav.focusPadding;

        const roomWidth = maxX - minX;
        const roomHeight = maxY - minY;

        const scaleX = this.canvas.width / (roomWidth + padding * 2);
        const scaleY = this.canvas.height / (roomHeight + padding * 2);

        let targetScale = Math.min(scaleX, scaleY);
        targetScale = Math.max(this.nav.minScale, Math.min(this.nav.maxScale, targetScale));

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const targetOffsetX = this.canvas.width / 2 - centerX * targetScale;
        const targetOffsetY = this.canvas.height / 2 - centerY * targetScale;

        return { targetScale, targetOffsetX, targetOffsetY };
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
        if (this.minimapCanvas) {
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
        }

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

            // Clamping über nav-Config
            this.targetScale = Math.max(this.nav.minScale, Math.min(this.nav.maxScale, this.targetScale));

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
        // Etage automatisch setzen
        const floor = this.getFloorOfRoom(roomId);
        if (floor !== null && floor !== this.activeFloor) {
            this.setActiveFloor(floor);
        }

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

        // 4.11 – Auto‑Scroll zum aktiven Raum
        this._scrollActiveRoomIntoView();

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
    },

    // 4.11 – Auto‑Scroll zum aktiven Raum
    _scrollActiveRoomIntoView() {
        const active = document.querySelector("#sh-group-rooms .active-room");
        if (!active) return;

        active.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
        });
    },

    _scrollActiveFloorIntoView() {
        const active = document.querySelector(".sh-floor-item.active");
        if (!active) return;

        active.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    },

    onFloorScrollEnd() {
        // Wenn noch Momentum vorhanden ist → erst auslaufen lassen
        if (Math.abs(this.floorScroll.velocity) > 0.25) {
            this.applyFloorMomentum();
            return;
        }

        // Dead‑Zone: Mini‑Bewegungen ignorieren
        if (Math.abs(this.floorScroll.velocity) < 0.02) {
            return; // kein Snap, kein Momentum
        }

        const list = document.getElementById("sh-floor-list");
        if (!list) return;

        const items = Array.from(list.querySelectorAll(".sh-floor-item"));
        if (items.length === 0) return;

        // 1) Aktuelle Scrollposition
        const scrollTop = list.scrollTop;
        const itemHeight = items[0].offsetHeight;

        // 2) Aktuellen Index bestimmen
        let currentIndex = scrollTop / itemHeight;

        // Richtung berücksichtigen
        if (this.floorScroll.velocity > 0) {
            currentIndex = Math.floor(currentIndex);
        } else {
            currentIndex = Math.ceil(currentIndex);
        }

        // 3) Velocity auswerten (px/ms)
        const v = this.floorScroll.velocity;

        let targetIndex = currentIndex;

        // 4) Richtung bestimmen
        if (v > 0.12) {
            targetIndex = currentIndex + 1;
        } else if (v < -0.12) {
            targetIndex = currentIndex - 1;
        }

        // 5) Grenzen + Stabilität
        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex >= items.length) targetIndex = items.length - 1;

        // Wenn Velocity klein → beim aktuellen Floor bleiben
        if (Math.abs(this.floorScroll.velocity) < 0.05) {
            targetIndex = currentIndex;
        }

        // 6) Ziel‑Element
        const targetItem = items[targetIndex];
        if (!targetItem) return;

        // Sanfter Snap‑Start
        setTimeout(() => {
            targetItem.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }, 20);

        // 8) Etage setzen
        const floorId = Number(targetItem.dataset.floor);
        this.setActiveFloor(floorId);
    },

    applyFloorMomentum() {
        const list = document.getElementById("sh-floor-list");
        if (!list) return;

        let v = this.floorScroll.velocity;
        // Velocity begrenzen (Clamping)
        v = Math.max(-0.8, Math.min(0.8, v));

        if (Math.abs(v) < 0.01) {
            // Geschwindigkeit zu gering → direkt einrasten
            setTimeout(() => this.onFloorScrollEnd(), 10);
            return;
        }

        const friction = 0.92; // Reibung pro Frame
        const frame = () => {
            v *= friction;

            list.scrollTop += v * 20; // Geschwindigkeit → Pixelbewegung

            if (Math.abs(v) < 0.01) {
                // Stop → Snap‑Scrolling
                setTimeout(() => this.onFloorScrollEnd(), 10);
                return;
            }

            requestAnimationFrame(frame);
        };

        requestAnimationFrame(frame);
    },

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

        // Räume nach aktiver Etage filtern (oder alle, wenn keine aktiv)
        this.rooms = this.activeFloor
            ? SmartHomeData.rooms.filter(r => r.floor === this.activeFloor)
            : SmartHomeData.rooms;

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

        // Räume nach aktiver Etage filtern (oder alle)
        const rooms = this.activeFloor
            ? SmartHomeData.rooms.filter(r => r.floor === this.activeFloor)
            : SmartHomeData.rooms;

        this.minimapRooms = rooms.map(r => ({
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

    getFloorOfRoom(roomId) {
        const room = SmartHomeData.getRoom(roomId);
        if (!room) return null;
        return room.floor ?? null;
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
