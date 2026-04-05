// ======================================================
// Raumdesigner – vollständige, fehlerfreie Version
// ======================================================

const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],
    walls: [],
    doors: [],
    windows: [],

    hover: { x: 0, y: 0 },

    selectedPoint: null,
    selectedDoorIndex: null,
    selectedWindowIndex: null,

    isDragging: false,
    _initialized: false,

    mode: "points",   // "points" | "doors" | "windows"
    isClosed: false,

    draggingDoorIndex: null,
    draggingWindowIndex: null,

    PIXELS_PER_METER: 40,

    // Kontext-Menü
    contextMenuEl: null,
    contextTarget: null,

    // Delete-Toast
    _toastEl: null,
    _toastConfirmFn: null,

    // --------------------------------------------------
    // Initialisierung
    // --------------------------------------------------
    init() {
        if (this._initialized) return;
        this._initialized = true;

        this.canvas = document.getElementById("roomdesigner");
        this.ctx = this.canvas.getContext("2d");

        window.addEventListener("resize", () => this.resize());
        this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
        this.canvas.addEventListener("mousedown", (e) => this.onDown(e));
        this.canvas.addEventListener("mouseup", () => this.onUp());
        this.canvas.addEventListener("contextmenu", (e) => this.onRightClick(e));

        this.setupDoorButton();
        this.setupWindowButton();
        this.createContextMenu();

        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // --------------------------------------------------
    // Rechtsklick verhindern
    // --------------------------------------------------
    onRightClick(e) {
        e.preventDefault();
        this.hideContextMenu();
    },

    // --------------------------------------------------
    // Kontext-Menü
    // --------------------------------------------------
    createContextMenu() {
        const el = document.createElement("div");
        el.id = "rd-context-menu";
        el.style.position = "fixed";
        el.style.display = "none";
        el.style.background = "rgba(0,0,0,0.85)";
        el.style.padding = "6px";
        el.style.borderRadius = "6px";
        el.style.zIndex = "20000";
        el.style.display = "flex";
        el.style.gap = "6px";

        document.body.appendChild(el);
        this.contextMenuEl = el;
    },

    hideContextMenu() {
        if (!this.contextMenuEl) return;
        this.contextMenuEl.style.display = "none";
        this.contextTarget = null;
    },

    showContextMenu(x, y, type, index) {
        const menu = this.contextMenuEl;
        menu.innerHTML = "";
        this.contextTarget = { type, index };

        if (type === "point") {
            this.addContextButton("🗑", () => {
                const p = this.points[index];
                this.points = this.points.filter(pt => pt !== p);
                if (this.points.length < 3) this.isClosed = false;
                this.updateWalls();
                this.hideContextMenu();
                this.render();
            });
        }

        if (type === "door" || type === "window") {
            const arr = type === "door" ? this.doors : this.windows;

            this.addContextButton("＋", () => {
                arr[index].width += 10;
                this.updateWalls();
                this.render();
            });

            this.addContextButton("－", () => {
                arr[index].width = Math.max(20, arr[index].width - 10);
                this.updateWalls();
                this.render();
            });

            this.addContextButton("🗑", () => {
                arr.splice(index, 1);
                this.hideContextMenu();
                this.render();
            });
        }

        menu.style.display = "flex";

        const rect = menu.getBoundingClientRect();
        const spaceRight = window.innerWidth - x - rect.width - 10;
        const spaceTop = y - rect.height - 10;
        const spaceBottom = window.innerHeight - y - rect.height - 10;

        if (spaceRight > 0) {
            menu.style.left = (x + 10) + "px";
            menu.style.top = (y - rect.height / 2) + "px";
        } else if (spaceTop > 0) {
            menu.style.left = (x - rect.width / 2) + "px";
            menu.style.top = (y - rect.height - 10) + "px";
        } else if (spaceBottom > 0) {
            menu.style.left = (x - rect.width / 2) + "px";
            menu.style.top = (y + 10) + "px";
        } else {
            menu.style.left = (x - rect.width - 10) + "px";
            menu.style.top = (y - rect.height / 2) + "px";
        }
    },

    addContextButton(label, fn) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.width = "32px";
        btn.style.height = "32px";
        btn.style.fontSize = "18px";
        btn.style.border = "none";
        btn.style.borderRadius = "4px";
        btn.style.background = "#444";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.addEventListener("click", fn);
        this.contextMenuEl.appendChild(btn);
    },

    // --------------------------------------------------
    // Eingaben
    // --------------------------------------------------
    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        let hx = e.clientX - rect.left;
        let hy = e.clientY - rect.top;

        if (this.points.length > 0) {
            const first = this.points[0];
            if (!this.isClosed && Math.hypot(hx - first.x, hy - first.y) < 20) {
                hx = first.x;
                hy = first.y;
            }
        }

        this.hover.x = hx;
        this.hover.y = hy;

        if (this.draggingDoorIndex !== null) {
            const d = this.doors[this.draggingDoorIndex];
            const w = this.walls[d.wallIndex];
            if (w) {
                const proj = this.projectOnWall(hx, hy, w);
                d.t = proj.t;
                d.x = proj.x;
                d.y = proj.y;
            }
            this.render();
            return;
        }

        if (this.draggingWindowIndex !== null) {
            const wObj = this.windows[this.draggingWindowIndex];
            const w = this.walls[wObj.wallIndex];
            if (w) {
                const proj = this.projectOnWall(hx, hy, w);
                wObj.t = proj.t;
                wObj.x = proj.x;
                wObj.y = proj.y;
            }
            this.render();
            return;
        }

        if (this.isDragging && this.selectedPoint) {
            this.selectedPoint.x = hx;
            this.selectedPoint.y = hy;
            this.updateWalls();
        }

        this.render();
    },

    // --------------------------------------------------
    // HIT-DETECTION REIHENFOLGE (wichtig!)
    // --------------------------------------------------
    hitTest(x, y) {
        const doorIndex = this.getDoorIndexAt(x, y);
        if (doorIndex !== null) return { type: "door", index: doorIndex };

        const windowIndex = this.getWindowIndexAt(x, y);
        if (windowIndex !== null) return { type: "window", index: windowIndex };

        const point = this.getPointAt(x, y);
        if (point) return { type: "point", index: this.points.indexOf(point) };

        const wall = this.getWallAt(x, y);
        if (wall) return { type: "wall", data: wall };

        return { type: "empty" };
    },

onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (e.button === 2) {
        this.hideContextMenu();
        return;
    }

    this.hideContextMenu();

    // --------------------------------------------------
    // WICHTIG: Punkte setzen, bevor Hit-Test greift
    // --------------------------------------------------
    if (!this.isClosed && this.points.length < 3) {
        this.points.push({ x, y });
        this.updateWalls();
        this.render();
        return;
    }

    const hit = this.hitTest(x, y);

    // --------------------------------------------------
    // FENSTER-MODUS (einmalig)
    // --------------------------------------------------
    if (this.mode === "windows") {
        if (hit.type === "window") {
            this.showContextMenu(x, y, "window", hit.index);
            return;
        }

        if (hit.type === "wall") {
            const w = hit.data;
            this.windows.push({
                wallIndex: w.index,
                t: w.t,
                x: w.x,
                y: w.y,
                width: 80
            });
            this.updateWalls();
            this.render();
        }

        this.mode = "points";
        return;
    }

    // --------------------------------------------------
    // TÜR-MODUS (3-Schritte)
    // --------------------------------------------------
    if (this.mode === "doors") {

        // Schritt 2: Tür setzen
        if (!this._placingDoor) {
            if (hit.type === "wall") {
                const w = hit.data;
                this.doors.push({
                    wallIndex: w.index,
                    t: w.t,
                    x: w.x,
                    y: w.y,
                    width: 36,
                    hinge: null,
                    side: 1
                });
                this._placingDoor = true;
                this.render();
                return;
            }
        }

        // Schritt 3: Scharnier wählen
        if (this._placingDoor) {
            const lastDoor = this.doors[this.doors.length - 1];
            const w = this.walls[lastDoor.wallIndex];
            this.setDoorHingeFromTap(lastDoor, x, y, w);

            this._placingDoor = false;
            this.mode = "points";
            this.render();
            return;
        }
    }

    // --------------------------------------------------
    // PUNKT-MODUS
    // --------------------------------------------------
    if (hit.type === "door") {
        this.showContextMenu(x, y, "door", hit.index);
        return;
    }

    if (hit.type === "window") {
        this.showContextMenu(x, y, "window", hit.index);
        return;
    }

    if (hit.type === "point") {
        this.selectedPoint = this.points[hit.index];
        this.isDragging = true;
        this.showContextMenu(x, y, "point", hit.index);
        return;
    }

    if (hit.type === "wall" && !this.isClosed) {
        const w = hit.data;
        const insertPoint = { x: w.x, y: w.y };

        if (w.index < this.points.length - 1) {
            this.points.splice(w.index + 1, 0, insertPoint);
        } else {
            this.points.push(insertPoint);
        }

        this.updateWalls();
        this.render();
        return;
    }
},

    onUp() {
        this.isDragging = false;
        this.selectedPoint = null;
        this.draggingDoorIndex = null;
        this.draggingWindowIndex = null;
    },
    // --------------------------------------------------
    // Hilfsfunktionen
    // --------------------------------------------------
    getPointAt(x, y) {
        return this.points.find(p => Math.hypot(p.x - x, p.y - y) < 10);
    },

    getDoorIndexAt(x, y) {
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            if (Math.hypot(d.x - x, d.y - y) < 15) return i;
        }
        return null;
    },

    getWindowIndexAt(x, y) {
        for (let i = 0; i < this.windows.length; i++) {
            const w = this.windows[i];
            if (Math.hypot(w.x - x, w.y - y) < 15) return i;
        }
        return null;
    },

    getWallAt(x, y) {
        for (let i = 0; i < this.walls.length; i++) {
            const w = this.walls[i];

            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };

            const ABx = B.x - A.x;
            const ABy = B.y - A.y;
            const APx = x - A.x;
            const APy = y - A.y;

            const abLen = Math.hypot(ABx, ABy);
            if (abLen === 0) continue;

            const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / (abLen * abLen)));

            const cx = A.x + t * ABx;
            const cy = A.y + t * ABy;

            if (Math.hypot(x - cx, y - cy) < 10) {
                return { index: i, t, x: cx, y: cy };
            }
        }
        return null;
    },

    projectOnWall(x, y, w) {
        const A = { x: w.x1, y: w.y1 };
        const B = { x: w.x2, y: w.y2 };

        const ABx = B.x - A.x;
        const ABy = B.y - A.y;
        const APx = x - A.x;
        const APy = y - A.y;

        const abLen2 = ABx * ABx + ABy * ABy;
        if (abLen2 === 0) return { t: 0, x: A.x, y: A.y };

        let t = (APx * ABx + APy * ABy) / abLen2;
        t = Math.max(0, Math.min(1, t));

        return {
            t,
            x: A.x + t * ABx,
            y: A.y + t * ABy
        };
    },

    // --------------------------------------------------
    // Tür-Scharnier (alte Logik, exakt wie früher)
    // --------------------------------------------------
    setDoorHingeFromTap(door, tapX, tapY, wall) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const tx = dx / len;
        const ty = dy / len;

        const cx = door.x;
        const cy = door.y;
        const half = door.width / 2;

        const x1 = cx - tx * half;
        const y1 = cy - ty * half;

        const x2 = cx + tx * half;
        const y2 = cy + ty * half;

        const d1 = Math.hypot(tapX - x1, tapY - y1);
        const d2 = Math.hypot(tapX - x2, tapY - y2);

        let hx, hy, ox, oy;
        if (d1 <= d2) {
            door.hinge = "start";
            hx = x1; hy = y1;
            ox = x2; oy = y2;
        } else {
            door.hinge = "end";
            hx = x2; hy = y2;
            ox = x1; oy = y1;
        }

        const ex = ox - hx;
        const ey = oy - hy;
        const elen = Math.hypot(ex, ey);
        if (elen === 0) return;

        const vx = tapX - hx;
        const vy = tapY - hy;

        const cross = ex * vy - ey * vx;
        door.side = cross >= 0 ? 1 : -1;
    },

    // --------------------------------------------------
    // Wände aktualisieren
    // --------------------------------------------------
    updateWalls() {
        this.walls = [];

        if (this.points.length < 2) return;

        for (let i = 0; i < this.points.length - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];
            this.walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }

        if (this.isClosed && this.points.length > 2) {
            const last = this.points[this.points.length - 1];
            const first = this.points[0];
            this.walls.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
        }

        // Türen/Fenster mitwandern lassen
        for (const d of this.doors) {
            const w = this.walls[d.wallIndex];
            if (!w) continue;
            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };
            d.x = A.x + (B.x - A.x) * d.t;
            d.y = A.y + (B.y - A.y) * d.t;
        }

        for (const win of this.windows) {
            const w = this.walls[win.wallIndex];
            if (!w) continue;
            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };
            win.x = A.x + (B.x - A.x) * win.t;
            win.y = A.y + (B.y - A.y) * win.t;
        }
    },
    // --------------------------------------------------
    // Boden zeichnen
    // --------------------------------------------------
    drawFloor() {
        if (this.points.length < 3) return;

        const ctx = this.ctx;
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        if (this.isClosed) ctx.closePath();
        ctx.fill();
    },

    // --------------------------------------------------
    // Polygon zeichnen
    // --------------------------------------------------
    drawPolygon() {
        if (this.points.length === 0) return;

        const ctx = this.ctx;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        if (this.isClosed) ctx.closePath();
        ctx.stroke();

        // Punkte zeichnen
        for (const p of this.points) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --------------------------------------------------
    // Wände zeichnen
    // --------------------------------------------------
    drawWalls() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;

        for (const w of this.walls) {
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
        }
    },

    // --------------------------------------------------
    // Wandlängen
    // --------------------------------------------------
    drawWallLengths() {
        if (!this.isDragging || !this.selectedPoint) return;

        const ctx = this.ctx;
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;

        for (const w of this.walls) {
            const isEnd =
                (w.x1 === this.selectedPoint.x && w.y1 === this.selectedPoint.y) ||
                (w.x2 === this.selectedPoint.x && w.y2 === this.selectedPoint.y);

            if (!isEnd) continue;

            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const meters = len / this.PIXELS_PER_METER;
            const text = meters.toFixed(2) + " m";

            const mx = (w.x1 + w.x2) / 2;
            const my = (w.y1 + w.y2) / 2;

            ctx.save();
            ctx.translate(mx, my - 10);

            ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    },

    // --------------------------------------------------
    // Winkelanzeige
    // --------------------------------------------------
    drawAngleAtPoint(P, A, B) {
        const ctx = this.ctx;

        const v1x = A.x - P.x;
        const v1y = A.y - P.y;
        const v2x = B.x - P.x;
        const v2y = B.y - P.y;

        const dot = v1x * v2x + v1y * v2y;
        const len1 = Math.sqrt(v1x*v1x + v1y*v1y);
        const len2 = Math.sqrt(v2x*v2x + v2y*v2y);

        if (len1 === 0 || len2 === 0) return;

        const angle = Math.acos(dot / (len1 * len2));
        const deg = (angle * 180 / Math.PI).toFixed(1);

        ctx.font = "14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;

        ctx.strokeText(deg + "°", P.x + 12, P.y - 12);
        ctx.fillText(deg + "°", P.x + 12, P.y - 12);
    },

    // --------------------------------------------------
    // Türen zeichnen (alte Darstellung)
    // --------------------------------------------------
    drawDoors() {
        const ctx = this.ctx;

        for (const d of this.doors) {
            const w = this.walls[d.wallIndex];
            if (!w) continue;

            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const tx = dx / len;
            const ty = dy / len;

            const cx = d.x;
            const cy = d.y;

            const half = d.width / 2;

            const x1 = cx - tx * half;
            const y1 = cy - ty * half;

            const x2 = cx + tx * half;
            const y2 = cy + ty * half;

            // Türblatt
            ctx.strokeStyle = "#00ffc8";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (!d.hinge) continue;

            // Scharnierpunkt + anderes Ende
            let hx, hy, ox, oy;
            if (d.hinge === "start") {
                hx = x1; hy = y1;
                ox = x2; oy = y2;
            } else {
                hx = x2; hy = y2;
                ox = x1; oy = y1;
            }

            const ex = ox - hx;
            const ey = oy - hy;
            const elen = Math.sqrt(ex*ex + ey*ey);
            if (elen === 0) continue;

            const px = -ey / elen;
            const py = ex / elen;

            const side = d.side || 1;

            const sx = hx + px * elen * side;
            const sy = hy + py * elen * side;

            // Anschlag-Strich
            ctx.strokeStyle = "rgba(0,255,200,0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Viertelkreis
            const baseVecX = px * elen * side;
            const baseVecY = py * elen * side;

            const steps = 24;
            ctx.strokeStyle = "rgba(0,255,200,0.25)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const angle = -side * (Math.PI / 2) * t;

                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                const rx = baseVecX * cosA - baseVecY * sinA;
                const ry = baseVecX * sinA + baseVecY * cosA;

                const px2 = hx + rx;
                const py2 = hy + ry;

                if (i === 0) ctx.moveTo(px2, py2);
                else ctx.lineTo(px2, py2);
            }

            ctx.stroke();
        }
    },

    // --------------------------------------------------
    // Fenster zeichnen
    // --------------------------------------------------
    drawWindows() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#4aa3ff";
        ctx.lineWidth = 4;

        for (const w of this.windows) {
            const wall = this.walls[w.wallIndex];
            if (!wall) continue;

            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const tx = dx / len;
            const ty = dy / len;

            const cx = w.x;
            const cy = w.y;

            const half = w.width / 2;

            const x1 = cx - tx * half;
            const y1 = cy - ty * half;

            const x2 = cx + tx * half;
            const y2 = cy + ty * half;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    },

    // --------------------------------------------------
    // Hover-Kreuz
    // --------------------------------------------------
    drawHoverCross() {
        const ctx = this.ctx;
        const { x, y } = this.hover;

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
    },

    // --------------------------------------------------
    // Buttons (Tür/Fenster EINMALIG)
    // --------------------------------------------------
    setupDoorButton() {
        const btn = document.getElementById("btnDoorMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.mode = "doors";
            this._placingDoor = false;
        });
    },

    setupWindowButton() {
        const btn = document.getElementById("btnWindowMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.mode = "windows";
        });
    },
    // --------------------------------------------------
    // Delete-Toast
    // --------------------------------------------------
    showDeleteToast(message, onConfirm) {
        this._toastConfirmFn = onConfirm;

        if (!this._toastEl) {
            const el = document.createElement("div");
            el.style.position = "fixed";
            el.style.left = "50%";
            el.style.bottom = "20px";
            el.style.transform = "translateX(-50%)";
            el.style.background = "rgba(0,0,0,0.85)";
            el.style.color = "#fff";
            el.style.padding = "16px 20px";
            el.style.borderRadius = "10px";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.gap = "12px";
            el.style.zIndex = "10000";
            el.style.fontSize = "16px";

            const textSpan = document.createElement("span");
            textSpan.id = "rd-toast-text";

            const btnYes = document.createElement("button");
            btnYes.textContent = "Löschen";
            btnYes.style.padding = "10px 16px";
            btnYes.style.border = "none";
            btnYes.style.borderRadius = "6px";
            btnYes.style.background = "#e74c3c";
            btnYes.style.color = "#fff";
            btnYes.style.fontSize = "16px";

            const btnNo = document.createElement("button");
            btnNo.textContent = "Abbrechen";
            btnNo.style.padding = "10px 16px";
            btnNo.style.border = "none";
            btnNo.style.borderRadius = "6px";
            btnNo.style.background = "#555";
            btnNo.style.color = "#fff";
            btnNo.style.fontSize = "16px";

            btnYes.addEventListener("click", () => {
                if (this._toastConfirmFn) this._toastConfirmFn();
                this.hideToast();
            });

            btnNo.addEventListener("click", () => {
                this.hideToast();
            });

            el.appendChild(textSpan);
            el.appendChild(btnYes);
            el.appendChild(btnNo);

            document.body.appendChild(el);
            this._toastEl = el;
        }

        const textSpan = this._toastEl.querySelector("#rd-toast-text");
        if (textSpan) textSpan.textContent = message;

        this._toastEl.style.display = "flex";
    },

    hideToast() {
        if (this._toastEl) {
            this._toastEl.style.display = "none";
        }
        this._toastConfirmFn = null;
    }
}; // Ende RoomDesigner


// --------------------------------------------------
// Editor öffnen
// --------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btnOpenEditor");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
        const root = document.getElementById("smarthome-root");
        const header = document.getElementById("sh-group-header");
        const minimap = document.getElementById("smarthome-minimap");

        if (root) root.style.display = "none";
        if (header) header.style.display = "none";
        if (minimap) minimap.style.display = "none";

        const canvas = document.getElementById("roomdesigner");
        const doorBtn = document.getElementById("btnDoorMode");
        const winBtn = document.getElementById("btnWindowMode");

        if (canvas) canvas.style.display = "block";
        if (doorBtn) doorBtn.style.display = "block";
        if (winBtn) winBtn.style.display = "block";

        RoomDesigner.init();
    });
});
