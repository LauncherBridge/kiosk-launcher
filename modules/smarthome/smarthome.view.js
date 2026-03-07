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

        // Draw initial content
        this._drawPlaceholder();
        this._drawMiniMap();
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

    _bindEvents() {
        // Klick auf Haupt‑Canvas
        this.canvas.addEventListener("click", (ev) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;

            for (const room of this.rooms) {
                if (this._pointInPolygon({ x, y }, room.points)) {
                    this.activeRoom = room.id;
                    this._drawPlaceholder();
                    this._drawMiniMap();
                    break;
                }
            }
        });

        // Klick auf Mini‑Map
        this.minimapCanvas.addEventListener("click", (ev) => {
            const rect = this.minimapCanvas.getBoundingClientRect();
            const x = ev.clientX - rect.left;
            const y = ev.clientY - rect.top;

            for (const r of this.minimapRooms) {
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.activeRoom = r.id;
                    this._drawPlaceholder();
                    this._drawMiniMap();
                    break;
                }
            }
        });
    },

    _drawPlaceholder() {
        const ctx = this.ctx;
        if (!ctx) return;

        // Hintergrund leicht abdunkeln
        ctx.fillStyle = "#00000033";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

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

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.rooms.forEach(room => {
            // Highlight oder normal
            ctx.fillStyle = (this.activeRoom === room.id)
                ? "#FFB86C55"
                : room.color;

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
                ? "#FFB86C55"
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
