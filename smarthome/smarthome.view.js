// smarthome.view.js — FINAL VERSION WITH MERGED DOORS (3.2c)

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    minimapCanvas: null,
    minimapCtx: null,

    activeRoom: null,
    activeGroup: null,
    rooms: [],
    minimapRooms: [],

    floorScroll: {
        lastY: 0,
        lastTime: 0,
        velocity: 0,
        isTouching: false
    },

    scale: 1,
    targetScale: 1,
    offsetX: 0,
    offsetY: 0,
    targetOffsetX: 0,
    targetOffsetY: 0,

    isPanning: false,
    panStartX: 0,
    panStartY: 0,

    swipe: {
        startX: 0,
        startY: 0,
        startTime: 0,
        isTouching: false
    },

    highlightAlpha: 0,
    targetHighlightAlpha: 0,

    animationFrame: null,

    nav: {
        minScale: 0.3,
        maxScale: 3,
        focusPadding: 80,
        zoomLerp: 0.15,
        panLerp: 0.15
    },

init() {
    this.canvas = document.getElementById("smarthome-canvas");
    this.overlay = document.getElementById("smarthome-overlay");

    if (!this.canvas) {
        console.error("SmartHomeView: Canvas not found");
        return;
    }

    this.ctx = this.canvas.getContext("2d");

    this.minimapCanvas = document.getElementById("smarthome-minimap-canvas");
    if (this.minimapCanvas) {
        this.minimapCtx = this.minimapCanvas.getContext("2d");
    }

    // ---------------------------------------------------------
    // INTERNER STATUS (Schritt 7 Fix)
    // ---------------------------------------------------------
    this._isDragging = false;
    this._dragStart = null;

    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this.swipe = {
        isTouching: false,
        startX: 0,
        startY: 0,
        startTime: 0
    };

    // ---------------------------------------------------------
    // CANVAS GRÖSSE
    // ---------------------------------------------------------
    this._resize();
    window.addEventListener("resize", () => this._resize());

    // ---------------------------------------------------------
    // EVENTS BINDEN (benötigt _isDragging!)
    // ---------------------------------------------------------
    this._bindEvents();

    // ---------------------------------------------------------
    // RENDER LOOP
    // ---------------------------------------------------------
    this._startRenderLoop();

    // ---------------------------------------------------------
    // POPUP CLOSE
    // ---------------------------------------------------------
    const closeBtn = document.getElementById("sh-popup-close");
    if (closeBtn) closeBtn.addEventListener("click", () => this.closePopup());

    // ---------------------------------------------------------
    // GROUP BACK BUTTON
    // ---------------------------------------------------------
    const backBtn = document.getElementById("sh-group-back");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (this.activeGroup) {
                const firstRoom = this.activeGroup.roomIds[0];
                this._goToRoom(firstRoom);
            }
        });
    }

    // ---------------------------------------------------------
    // FLOOR LIST
    // ---------------------------------------------------------
    this.renderFloorList();
    this.bindFloorListEvents();

    if (!this.activeFloor && SmartHomeData.floors.length > 0) {
        this.activeFloor = SmartHomeData.floors[0].id;
    }

    this.setActiveFloor(this.activeFloor);
},


    // ---------------------------------------------------------
    // FLOOR LIST
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

        el.addEventListener("click", (ev) => {
            const item = ev.target.closest(".sh-floor-item");
            if (!item) return;
            const floorId = Number(item.dataset.floor);
            this.setActiveFloor(floorId);
        });

        const list = el;

        const start = (y) => {
            this.floorScroll.lastY = y;
            this.floorScroll.lastTime = performance.now();
            this.floorScroll.velocity = 0;
            this.floorScroll.isTouching = true;
        };

        list.addEventListener("touchstart", (ev) => start(ev.touches[0].clientY));
        list.addEventListener("mousedown", (ev) => start(ev.clientY));

        const move = (y) => {
            if (!this.floorScroll.isTouching) return;
            const now = performance.now();
            const dy = y - this.floorScroll.lastY;
            const dt = now - this.floorScroll.lastTime;
            if (dt > 0) this.floorScroll.velocity = dy / dt;
            this.floorScroll.lastY = y;
            this.floorScroll.lastTime = now;
        };

        list.addEventListener("touchmove", (ev) => move(ev.touches[0].clientY));
        window.addEventListener("mousemove", (ev) => move(ev.clientY));

        const end = () => {
            if (!this.floorScroll.isTouching) return;
            this.floorScroll.isTouching = false;
            this.onFloorScrollEnd();
        };

        list.addEventListener("touchend", end);
        window.addEventListener("mouseup", end);
    },

    setActiveFloor(floorId) {
        if (this.activeFloor === floorId) return;

        this.activeFloor = floorId;

        document.querySelectorAll(".sh-floor-item").forEach(item => {
            item.classList.toggle("active", Number(item.dataset.floor) === floorId);
        });

        this._scrollActiveFloorIntoView();

        this.activeRoom = null;
        this.targetScale = 1;
        this.targetOffsetX = 0;
        this.targetOffsetY = 0;
        this.activeGroup = null;
        this.targetHighlightAlpha = 0;

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.minimapRooms = [];
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

    // ---------------------------------------------------------
    // SWIPE (unchanged)
    // ---------------------------------------------------------
    _handleSwipe(dx, dy) {
        if (!this.activeRoom) return;

        const minDistance = 30;
        const distance = Math.hypot(dx, dy);
        if (distance < minDistance) return;

        const room = SmartHomeData.getRoom(this.activeRoom);
        if (!room || !room.doors || room.doors.length === 0) return;

        const dirX = dx / distance;
        const dirY = dy / distance;

        const center = this._getRoomCenter(room);

        let bestDoor = null;
        let bestDot = -1;

        room.doors.forEach(door => {
            const vx = door.position.x - center.x;
            const vy = door.position.y - center.y;
            const len = Math.hypot(vx, vy);
            if (len === 0) return;

            const nx = vx / len;
            const ny = vy / len;

            const dot = nx * dirX + ny * dirY;
            if (dot > bestDot) {
                bestDot = dot;
                bestDoor = door;
            }
        });

        if (!bestDoor || bestDot < 0.5) return;

        const targetRoom = this._findAdjacentRoom(room.id, bestDoor);
        if (!targetRoom) return;

        if (targetRoom.floor !== this.activeFloor) return;

        this._goToRoom(targetRoom.id);
    },

    _getRoomCenter(room) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        room.polygon.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    },

    // ---------------------------------------------------------
    // EVENTS (with merged door click)
    // ---------------------------------------------------------
_bindEvents() {

    // ---------------------------------------------------------
    // CLICK (nur wenn NICHT gepannt wurde)
    // ---------------------------------------------------------
    this.canvas.addEventListener("click", (ev) => {
        if (this._isDragging) return; // <-- WICHTIGER FIX

        const rect = this.canvas.getBoundingClientRect();
        let x = (ev.clientX - rect.left - this.offsetX) / this.scale;
        let y = (ev.clientY - rect.top - this.offsetY) / this.scale;

        // Container click
        for (const container of SmartHomeData.containers) {
            const dx = container.position.x;
            const dy = container.position.y;
            if (Math.hypot(x - dx, y - dy) < 20) {
                SmartHomeView.openContainerPopup(container);
                return;
            }
        }

        // MERGED DOOR CLICK
        const mergedDoors = SmartHomeData.getMergedDoorsForFloor(this.activeFloor);
        for (const d of mergedDoors) {
            const dx = x - d.mergedPos.x;
            const dy = y - d.mergedPos.y;
            if (Math.hypot(dx, dy) < 14) {
                let targetRoomId = null;

                if (this.activeRoom === d.roomA) targetRoomId = d.roomB;
                else if (this.activeRoom === d.roomB) targetRoomId = d.roomA;
                else targetRoomId = d.roomA;

                const targetRoom = SmartHomeData.getRoom(targetRoomId);
                if (targetRoom && targetRoom.floor === this.activeFloor) {
                    this._goToRoom(targetRoom.id);
                    return;
                }
            }
        }

        // Room click
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

    // ---------------------------------------------------------
    // MINIMAP CLICK (unverändert)
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // ZOOM (Schritt 11 – stabiler Zoom ohne Springen)
    // ---------------------------------------------------------
    this.canvas.addEventListener("wheel", (ev) => {
        ev.preventDefault();
    
        const zoomIntensity = 0.1;
        const oldScale = this.scale;
    
        // Neue Ziel-Skalierung
        if (ev.deltaY < 0) this.targetScale *= (1 + zoomIntensity);
        else this.targetScale *= (1 - zoomIntensity);
    
        // Begrenzen
        this.targetScale = Math.max(this.nav.minScale, Math.min(this.nav.maxScale, this.targetScale));
    
        // Mausposition relativ zum Canvas
        const rect = this.canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
    
        // Verhältnis der Skalierung
        const scaleFactor = this.targetScale / oldScale;
    
        // Offset sofort anpassen (kein Springen mehr)
        this.offsetX = mx - (mx - this.offsetX) * scaleFactor;
        this.offsetY = my - (my - this.offsetY) * scaleFactor;
    
        // targetOffset synchron halten
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
    
        // scale sofort aktualisieren
        this.scale = this.targetScale;
    }, { passive: false });


    // ---------------------------------------------------------
    // PAN (Schritt 12 – sofortiges, stabiles Panning)
    // ---------------------------------------------------------
    this.canvas.addEventListener("mousedown", (ev) => {
        this._isDragging = false;
        this._dragStart = { x: ev.clientX, y: ev.clientY };
    
        this.isPanning = true;
    
        // Startposition relativ zu den aktuellen Offsets
        this.panStartX = ev.clientX - this.offsetX;
        this.panStartY = ev.clientY - this.offsetY;
    });
    
    window.addEventListener("mousemove", (ev) => {
        if (!this.isPanning) return;
    
        const dx = ev.clientX - this._dragStart.x;
        const dy = ev.clientY - this._dragStart.y;
    
        // Drag-Erkennung
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            this._isDragging = true;
        }
    
        // Sofortiges Panning (kein Nachziehen)
        this.offsetX = ev.clientX - this.panStartX;
        this.offsetY = ev.clientY - this.panStartY;
    
        // targetOffset synchron halten
        this.targetOffsetX = this.offsetX;
        this.targetOffsetY = this.offsetY;
    });
    
    window.addEventListener("mouseup", () => {
        this.isPanning = false;
        this._dragStart = null;
        this._isDragging = false; // Schritt 10 Fix bleibt bestehen
    });

    // ---------------------------------------------------------
    // SWIPE (unverändert)
    // ---------------------------------------------------------
    this.canvas.addEventListener("touchstart", (ev) => {
        if (ev.touches.length !== 1) return;
        const t = ev.touches[0];
        this.swipe.isTouching = true;
        this.swipe.startX = t.clientX;
        this.swipe.startY = t.clientY;
        this.swipe.startTime = performance.now();
    }, { passive: true });

    this.canvas.addEventListener("touchend", (ev) => {
        if (!this.swipe.isTouching) return;
        this.swipe.isTouching = false;

        const endTime = performance.now();
        const dt = endTime - this.swipe.startTime;
        if (dt > 600) return;

        const t = ev.changedTouches[0];
        const dx = t.clientX - this.swipe.startX;
        const dy = t.clientY - this.swipe.startY;

        this._handleSwipe(dx, dy);
    }, { passive: true });
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

            // 3.1 – Auto‑Zentrierung für Einzelraum
            const room = SmartHomeData.getRoom(roomId);
            if (room) {
                const bounds = this._getRoomBounds(room);
                const t = this._computeFocusTransform(bounds);

                this.targetScale = t.targetScale;
                this.targetOffsetX = t.targetOffsetX;
                this.targetOffsetY = t.targetOffsetY;
            }
            return;
        }

        // Gruppe
        this.activeRoom = roomId;
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

        const groupsByType = {};
        eff.group.roomIds.forEach(rid => {
            const room = SmartHomeData.getRoom(rid);
            if (!room) return;

            const type = SmartHomeData.roomTypes[room.type]?.group || "Andere";

            if (!groupsByType[type]) groupsByType[type] = [];
            groupsByType[type].push(room);
        });

        const sortedTypes = Object.keys(groupsByType).sort();

        sortedTypes.forEach(typeName => {
            const rooms = groupsByType[typeName].sort((a, b) =>
                a.name.localeCompare(b.name)
            );

            const line = document.createElement("div");
            line.className = "sh-group-line";

            const strong = document.createElement("strong");
            strong.textContent = typeName + " – ";
            line.appendChild(strong);

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
        if (Math.abs(this.floorScroll.velocity) > 0.25) {
            this.applyFloorMomentum();
            return;
        }

        if (Math.abs(this.floorScroll.velocity) < 0.02) {
            return;
        }

        const list = document.getElementById("sh-floor-list");
        if (!list) return;

        const items = Array.from(list.querySelectorAll(".sh-floor-item"));
        if (items.length === 0) return;

        const scrollTop = list.scrollTop;
        const itemHeight = items[0].offsetHeight;

        let currentIndex = scrollTop / itemHeight;

        if (this.floorScroll.velocity > 0) {
            currentIndex = Math.floor(currentIndex);
        } else {
            currentIndex = Math.ceil(currentIndex);
        }

        const v = this.floorScroll.velocity;

        let targetIndex = currentIndex;

        if (v > 0.12) {
            targetIndex = currentIndex + 1;
        } else if (v < -0.12) {
            targetIndex = currentIndex - 1;
        }

        if (targetIndex < 0) targetIndex = 0;
        if (targetIndex >= items.length) targetIndex = items.length - 1;

        if (Math.abs(this.floorScroll.velocity) < 0.05) {
            targetIndex = currentIndex;
        }

        const targetItem = items[targetIndex];
        if (!targetItem) return;

        setTimeout(() => {
            targetItem.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }, 20);

        const floorId = Number(targetItem.dataset.floor);
        this.setActiveFloor(floorId);
    },

    applyFloorMomentum() {
        const list = document.getElementById("sh-floor-list");
        if (!list) return;

        let v = this.floorScroll.velocity;
        v = Math.max(-0.8, Math.min(0.8, v));

        if (Math.abs(v) < 0.01) {
            setTimeout(() => this.onFloorScrollEnd(), 10);
            return;
        }

        const friction = 0.92;
        const frame = () => {
            v *= friction;

            list.scrollTop += v * 20;

            if (Math.abs(v) < 0.01) {
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

        this.rooms = this.activeFloor
            ? SmartHomeData.rooms.filter(r => r.floor === this.activeFloor)
            : SmartHomeData.rooms;

        const activeGroup = this.activeGroup ? this.activeGroup.roomIds : null;

        this.rooms.forEach(room => {
            const type = SmartHomeData.roomTypes[room.type];
            const fillColor = type?.color || "#444";

            const isInGroup = activeGroup && activeGroup.includes(room.id);

            if (this.activeRoom === room.id) {
                ctx.fillStyle = `rgba(255, 184, 108, ${0.3 + this.highlightAlpha * 0.4})`;
            } else {
                ctx.fillStyle = fillColor;
            }

            ctx.beginPath();
            ctx.moveTo(room.polygon[0].x, room.polygon[0].y);

            for (let i = 1; i < room.polygon.length; i++) {
                ctx.lineTo(room.polygon[i].x, room.polygon[i].y);
            }

            ctx.closePath();
            ctx.fill();

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

            ctx.fillStyle = "var(--sh-text)";
            ctx.font = "20px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(room.name, room.polygon[0].x + 12, room.polygon[0].y + 12);

            if (type?.icon) {
                ctx.fillStyle = "var(--sh-text)";
                ctx.font = "28px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const cx = (room.polygon[0].x + room.polygon[2].x) / 2;
                const cy = (room.polygon[0].y + room.polygon[2].y) / 2;

                ctx.fillText(type.icon, cx, cy);
            }

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

        // 3.2c – gemergte Türen im Main‑View rendern (Rechteck‑Steg entlang der Wand)
        const mergedDoors = SmartHomeData.getMergedDoorsForFloor(this.activeFloor);
        if (mergedDoors && mergedDoors.length) {
            mergedDoors.forEach(d => {
                const { posA, posB, mergedPos } = d;
                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const angle = Math.atan2(dy, dx);

                ctx.save();
                ctx.translate(mergedPos.x, mergedPos.y);
                ctx.rotate(angle);

                ctx.fillStyle = "#FFD28A";
                ctx.fillRect(-10, -3, 20, 6); // 20×6 px Steg

                ctx.restore();
            });
        }

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

            if (isInGroup) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
                ctx.fillRect(r.x, r.y, r.w, r.h);

                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 2;
                ctx.strokeRect(r.x, r.y, r.w, r.h);
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(r.label, r.x + 5, r.y + 5);

            if (type?.icon) {
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "14px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;

                ctx.fillText(type.icon, cx, cy);
            }

            // Container rendern (Mini‑Map)
            SmartHomeData.containers.forEach(container => {
                if (container.room !== r.id) return;

                const ctype = SmartHomeData.deviceTypes[container.type];
                const icon = ctype?.icon || "device_unknown";
                const color = ctype?.color || "#FFFFFF";

                const poly = r.polygon;
                const scaleX = r.w / (poly[1].x - poly[0].x);
                const scaleY = r.h / (poly[2].y - poly[1].y);

                const mx = r.x + (container.position.x - poly[0].x) * scaleX;
                const my = r.y + (container.position.y - poly[0].y) * scaleY;

                ctx.fillStyle = color;
                ctx.font = "12px MaterialIcons";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(icon, mx, my);
            });
        });

        // 3.2c – gemergte Türen in der Mini‑Map rendern (kleiner Steg)
        const mergedDoorsMini = SmartHomeData.getMergedDoorsForFloor(this.activeFloor);
        if (mergedDoorsMini && mergedDoorsMini.length) {
            mergedDoorsMini.forEach(d => {
                const { posA, posB, mergedPos, roomA } = d;

                const room = SmartHomeData.getRoom(roomA);
                if (!room) return;

                const rMini = this.minimapRooms.find(r => r.id === room.id);
                if (!rMini) return;

                const poly = rMini.polygon;
                const scaleX = rMini.w / (poly[1].x - poly[0].x);
                const scaleY = rMini.h / (poly[2].y - poly[1].y);

                const mx = rMini.x + (mergedPos.x - poly[0].x) * scaleX;
                const my = rMini.y + (mergedPos.y - poly[0].y) * scaleY;

                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const angle = Math.atan2(dy, dx);

                ctx.save();
                ctx.translate(mx, my);
                ctx.rotate(angle);

                ctx.fillStyle = "#FFD28A";
                ctx.fillRect(-4, -2, 8, 4); // kleiner Steg

                ctx.restore();
            });
        }

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

    // 3.2b – Tür-Nachbarraum bestimmen (für Swipe)
    _findAdjacentRoom(currentRoomId, door) {
        if (!door) return null;

        const targetId = door.connectsTo;
        if (!targetId || targetId === currentRoomId) return null;

        return SmartHomeData.getRoom(targetId) || null;
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

        document.querySelectorAll(".sh-popup-tabs button").forEach(btn => {
            btn.onclick = () => {
                this._renderPopupTab(container, btn.dataset.tab);
            };
        });

        this._renderPopupTab(container, "status");

        popup.classList.remove("hidden");
    },

    closePopup() {
        document.getElementById("smarthome-popup").classList.add("hidden");
    },

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

window.addEventListener("load", () => SmartHomeView.init());
