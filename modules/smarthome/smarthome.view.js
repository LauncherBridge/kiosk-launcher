// SmartHome Rendering Engine

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    minimapCanvas: null,
    minimapCtx: null,

    activeRoom: null,
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
        // Main canvas + overlay
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

        // Initial sizing
        this._resize();
        window.addEventListener("resize", () => this._resize());

        // Events aktivieren
        this._bindEvents();

        // Start animation loop
        this._startRenderLoop();
    },

    _resize() {
        // Main canvas
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

        // Mini‑Map canvas
        if (this.minimapCanvas) {
            this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
            this.minimapCanvas.height = this.minimapCanvas.offsetHeight;
        }
    },

    _startRenderLoop() {
        const loop = () => {
            this._animate();
            this._drawPlaceholder();
            this._drawMiniMap();
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    },

    _animate() {
        // Smooth zoom
        this.scale += (this.targetScale - this.scale) * 0.15;

        // Smooth pan
        this.offsetX += (this.targetOffsetX - this.offsetX) * 0.15;
        this.offsetY += (this.targetOffsetY - this.offsetY) * 0.15;

        // Smooth highlight
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

            for (const room of this.rooms) {
                if (this._pointInPolygon({ x, y }, room.points)) {
                    this.activeRoom = room.id;
                    this.targetHighlightAlpha = 1;
                    return;
                }
            }

            this.activeRoom = null;
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
                    this.activeRoom = r.id;
                    this.targetHighlightAlpha = 1;
                    return;
                }
            }

            this.activeRoom = null;
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

            // Begrenzen
            this.targetScale = Math.max(0.3, Math.min(3, this.targetScale));

            // Zoom auf Cursor zentrieren
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

    _drawPlaceholder() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Transformation aktivieren
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Dummy-Räume (Polygone)
        this.rooms = [
            {
                id: "wohnzimmer",
                name: "Wohnzimmer",
                color: "#3A3A3A",
                points: [
                    { x: 100, y: 100 },
                    { x: 400, y: 100 },
                    { x: 400, y: 300 },
                    { x: 100, y: 300 }
                ]
            },
            {
                id: "kueche",
                name: "Küche",
                color: "#4A4A4A",
                points: [
                    { x: 420, y: 100 },
                    { x: 650, y: 100 },
                    { x: 650, y: 250 },
                    { x: 420, y: 250 }
                ]
            },
            {
                id: "flur",
                name: "Flur",
                color: "#2F2F2F",
                points: [
                    { x: 100, y: 320 },
                    { x: 650, y: 320 },
                    { x: 650, y: 420 },
                    { x: 100, y: 420 }
                ]
            }
        ];

        this.rooms.forEach(room => {
            // Highlight oder normal
            if (this.activeRoom === room.id) {
                ctx.fillStyle = `rgba(255, 184, 108, ${0.3 + this.highlightAlpha * 0.4})`;
            } else {
                ctx.fillStyle = room.color;
            }

            ctx.beginPath();
            ctx.moveTo(room.points[0].x, room.points[0].y);

            for (let i = 1; i < room.points.length; i++) {
                ctx.lineTo(room.points[i].x, room.points[i].y);
            }

            ctx.closePath();
            ctx.fill();

            // Raum-Label
            ctx.fillStyle = "var(--sh-text)";
            ctx.font = "20px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(room.name, room.points[0].x + 12, room.points[0].y + 12);
        });

        ctx.restore();
    },

    _drawMiniMap() {
        const ctx = this.minimapCtx;
        if (!ctx) return;

        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Dummy-Räume für Mini-Map
        this.minimapRooms = [
            { id: "wohnzimmer", x: 10, y: 10, w: 60, h: 60, color: "#3A3A3A", label: "WZ" },
            { id: "kueche",     x: 75, y: 10, w: 50, h: 40, color: "#4A4A4A", label: "K"  },
            { id: "flur",       x: 10, y: 75, w: 115, h: 30, color: "#2F2F2F", label: "F"  }
        ];

        this.minimapRooms.forEach(r => {
            ctx.fillStyle = (this.activeRoom === r.id)
                ? `rgba(255, 184, 108, ${0.3 + this.highlightAlpha * 0.4})`
                : r.color;

            ctx.fillRect(r.x, r.y, r.w, r.h);

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px sans-serif";
            ctx.textBaseline = "top";
            ctx.fillText(r.label, r.x + 5, r.y + 5);
        });

        // Rahmen
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
    }
};
