const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const imageLoader = document.getElementById('imageLoader');
const clearAllBtn = document.getElementById('clearAllBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const toggleTrianglesBtn = document.getElementById('toggleTrianglesBtn');
const toggleWireframeBtn = document.getElementById('toggleWireframeBtn');
const toggleImageBtn = document.getElementById('toggleImageBtn');
const exportTrianglesBtn = document.getElementById('exportTrianglesBtn');
const exportTrianglesSvgBtn = document.getElementById('exportTrianglesSvgBtn');
const exportWireframeSvgBtn = document.getElementById('exportWireframeSvgBtn');
const exportCombinedSvgBtn = document.getElementById('exportCombinedSvgBtn');
const importMesh = document.getElementById('importMesh');
const exportMeshBtn = document.getElementById('exportMeshBtn');
const notification = document.getElementById('notification');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpBtn = helpModal.querySelector('.close-btn');

let backgroundImage = null;
let imageFilename = null;

// --- New state for Triangle Mode ---
let triangles = []; // Array of { vertices: [p1, p2, p3], color: 'rgba(...)' }
let partialTriangle = []; // Array of points for the triangle being built
let hoveredEdge = null; // The edge currently being hovered over
let showImage = true;
let showWireframe = false;
let showTriangles = true;
let originalImageData = null; // To hold raw pixel data of the original image
let offscreenCanvas = null; // To hold the original image for data extraction
let hoveredTriangle = null;
let hoveredVertex = null;
let isDraggingVertex = false;
let vertexBeingDragged = null;
let dragStartPos = { x: 0, y: 0 };
let didStartDragOnVertex = false;
let isInvalidDragPosition = false;
let notificationTimeout = null;


const POINT_RADIUS = 5;
const HIT_RADIUS = 10; // Larger radius for easier clicking to remove

// --- New state for Pan and Zoom ---
let scale = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
const MIN_SCALE = 0.1;
const MAX_SCALE = 100;
const ZOOM_SENSITIVITY = 0.1;

// --- Command Pattern for Undo/Redo ---

class AddTriangleCommand {
    constructor(triangle) { this.triangle = triangle; }
    execute() { triangles.push(this.triangle); }
    undo() { triangles.pop(); }
}

class RemoveTriangleCommand {
    constructor(triangle, index) {
        this.triangle = triangle;
        this.index = index;
    }
    execute() {
        triangles.splice(this.index, 1);
    }
    undo() {
        triangles.splice(this.index, 0, this.triangle);
    }
}

class MoveVertexCommand {
    constructor(vertex, startPos, endPos) {
        this.vertex = vertex;
        this.startPos = { ...startPos };
        this.endPos = { ...endPos };
        // Find affected triangles and store their original colors BEFORE the move.
        this.affectedTriangles = findTrianglesWithVertex(this.vertex).map(tri => ({
            triangle: tri,
            oldColor: tri.color
        }));
    }

    execute() {
        this.vertex.x = this.endPos.x;
        this.vertex.y = this.endPos.y;
        // Now, recalculate colors for the triangles we found earlier.
        this.affectedTriangles.forEach(item => {
            item.triangle.color = calculateAverageColor(item.triangle.vertices);
        });
    }

    undo() {
        this.vertex.x = this.startPos.x;
        this.vertex.y = this.startPos.y;
        // Restore the pre-calculated old colors.
        this.affectedTriangles.forEach(item => {
            item.triangle.color = item.oldColor;
        });
    }
}

class BulkUpdateCommand {
    constructor(newState) {
        this.newState = { triangles: [...newState.triangles] };
        this.oldState = { triangles: [...triangles] };
    }
    execute() {
        triangles = this.newState.triangles;
    }
    undo() {
        triangles = this.oldState.triangles;
    }
}

// --- History Management ---

const history = {
    undoStack: [],
    redoStack: [],

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack.length = 0; // Clear redo stack on new action
        updateUndoRedoButtons();
        draw();
    },

    undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        updateUndoRedoButtons();
        draw();
    },

    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        updateUndoRedoButtons();
        draw();
    },

    clear() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
        updateUndoRedoButtons();
    }
};

// --- UI Helpers ---

function showNotification(message) {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    notification.textContent = message;
    notification.classList.add('show');

    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 2500); // Show for 2.5 seconds
}

// --- Coordinate Transformation Helpers ---

function screenToWorld(screenPos) {
    return {
        x: (screenPos.x - panOffset.x) / scale,
        y: (screenPos.y - panOffset.y) / scale,
    };
}

// --- Drawing Functions ---

function draw() {
    if (!ctx) return;

    // Clear canvas with a reset transform
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw background image if it exists
    if (backgroundImage) {
        ctx.save();
        // Apply pan and zoom
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(scale, scale);

        // Draw the main image if visible
        if (showImage) {
            ctx.drawImage(backgroundImage, 0, 0);
        }

        // Draw wireframe if visible
        if (showWireframe) {
            const wireframeWidth = 1 / scale;
            triangles.forEach(tri => {
                ctx.beginPath();
                ctx.moveTo(tri.vertices[0].x, tri.vertices[0].y);
                ctx.lineTo(tri.vertices[1].x, tri.vertices[1].y);
                ctx.lineTo(tri.vertices[2].x, tri.vertices[2].y);
                ctx.closePath();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.lineWidth = wireframeWidth;
                ctx.stroke();
            });
        }

        // Draw completed triangles if visible
        if (showTriangles) {
            triangles.forEach(tri => {
                ctx.beginPath();
                ctx.moveTo(tri.vertices[0].x, tri.vertices[0].y);
                ctx.lineTo(tri.vertices[1].x, tri.vertices[1].y);
                ctx.lineTo(tri.vertices[2].x, tri.vertices[2].y);
                ctx.closePath();
                ctx.fillStyle = tri.color;
                ctx.fill(); // No stroke for seamless edges
            });
        }

        // Draw hovered triangle for removal
        if (hoveredTriangle) {
            ctx.beginPath();
            ctx.moveTo(hoveredTriangle.vertices[0].x, hoveredTriangle.vertices[0].y);
            ctx.lineTo(hoveredTriangle.vertices[1].x, hoveredTriangle.vertices[1].y);
            ctx.lineTo(hoveredTriangle.vertices[2].x, hoveredTriangle.vertices[2].y);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.lineWidth = 3 / scale;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Red tint for removal hover
            ctx.fill();
        }

        // Draw hovered edge
        // The hover effect should be visible whenever an edge can be selected.
        // The handleMouseMove function ensures hoveredEdge is null when an edge
        // cannot be selected, so we only need to check if it exists.
        if (hoveredEdge) {
            ctx.beginPath();
            ctx.moveTo(hoveredEdge.v1.x, hoveredEdge.v1.y);
            ctx.lineTo(hoveredEdge.v2.x, hoveredEdge.v2.y);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)'; // Cyan for hover
            ctx.lineWidth = 5 / scale;
            ctx.stroke();
        }

        // Highlight hovered vertex
        if (hoveredVertex && !isDraggingVertex) {
            ctx.beginPath();
            ctx.arc(hoveredVertex.x, hoveredVertex.y, (POINT_RADIUS + 5) / scale, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        }

        // Add feedback for dragging
        if (isDraggingVertex) {
            const color = isInvalidDragPosition ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(vertexBeingDragged.x, vertexBeingDragged.y, (POINT_RADIUS + 5) / scale, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        }


        // Draw partial triangle (feedback for user)
        if (partialTriangle.length > 0) {
            // Draw vertices of partial triangle
            const pointRadiusOnScreen = POINT_RADIUS / scale;
            partialTriangle.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, pointRadiusOnScreen, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'; // Green for pending points
                ctx.fill();
            });
            // Draw connecting lines for partial triangle
            if (partialTriangle.length > 1) {
                ctx.beginPath();
                ctx.moveTo(partialTriangle[0].x, partialTriangle[0].y);
                for (let i = 1; i < partialTriangle.length; i++) ctx.lineTo(partialTriangle[i].x, partialTriangle[i].y);
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
                ctx.lineWidth = 1.5 / scale;
                ctx.stroke();
            }
        }

        ctx.restore();
    } else {
        // Draw a placeholder message if no image is loaded
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Please load an image to begin.', canvas.width / 2, canvas.height / 2);
    }
}

// --- Event Handlers ---

function handleImageLoad(e) {
    const file = e.target.files[0];
    if (!file) {
        return;
    }
    imageFilename = file.name; // Store the filename

    const reader = new FileReader();
    reader.onload = function (event) {
        backgroundImage = new Image();
        backgroundImage.onload = function () {
            // Reset state and fit image to canvas view
            // Create an offscreen canvas to get image data without being affected by pan/zoom
            offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = backgroundImage.width;
            offscreenCanvas.height = backgroundImage.height;
            const offscreenCtx = offscreenCanvas.getContext('2d');
            offscreenCtx.drawImage(backgroundImage, 0, 0);
            originalImageData = offscreenCtx.getImageData(0, 0, backgroundImage.width, backgroundImage.height);

            // Also reset triangle state
            triangles = [];
            partialTriangle = [];
            showImage = true;
            showTriangles = true;
            showWireframe = false;
            updateAllToggleButtons();

            history.clear();

            const hRatio = canvas.width / backgroundImage.width;
            const vRatio = canvas.height / backgroundImage.height;
            // Fit image inside canvas, but don't scale up initially
            scale = Math.min(hRatio, vRatio, 1);

            // Center the image
            const initialWidth = backgroundImage.width * scale;
            const initialHeight = backgroundImage.height * scale;
            panOffset.x = (canvas.width - initialWidth) / 2;
            panOffset.y = (canvas.height - initialHeight) / 2;

            draw();
        }
        backgroundImage.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

function getMousePos(canvasEl, evt) {
    const rect = canvasEl.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function handleCanvasClick(e) {
    if (!backgroundImage) return;

    // If the mousedown that preceded this click was on a vertex,
    // and we were not already building a triangle, then it was the start of a drag.
    // So, ignore the click to prevent selecting an edge underneath the vertex.
    if (didStartDragOnVertex && partialTriangle.length === 0) {
        return;
    }

    handleTriangleClick(e);
}

function handleTriangleClick(e) {
    const screenPos = getMousePos(canvas, e);
    const worldPos = screenToWorld(screenPos);

    // If starting a new triangle, check for an edge click first
    if (partialTriangle.length === 0) {
        const edge = getEdgeNear(worldPos);
        if (edge) {
            partialTriangle.push(edge.v1, edge.v2);
            hoveredEdge = null; // Clear hover state after selection
            draw();
            return;
        }
    }

    // If one point is selected, check for an edge click to complete the triangle
    if (partialTriangle.length === 1) {
        const edge = getEdgeNear(worldPos);
        if (edge) {
            const firstVertex = partialTriangle[0];
            // Only form a triangle if the selected edge does not contain the first point.
            // If it does, we let the logic fall through to regular point-by-point selection.
            if (edge.v1 !== firstVertex && edge.v2 !== firstVertex) {
                const uniqueVertices = [firstVertex, edge.v1, edge.v2];

                if (!isDuplicateTriangle(uniqueVertices) && isNewTriangleValid(uniqueVertices)) {
                    const newTriangle = { vertices: uniqueVertices, color: calculateAverageColor(uniqueVertices) };
                    history.execute(new AddTriangleCommand(newTriangle));
                }
                partialTriangle = [];
                hoveredEdge = null;
                return; // Action complete
            }
        }
    }

    // If one edge is already selected, check for a click on a second, adjacent edge
    if (partialTriangle.length === 2) {
        const secondEdge = hoveredEdge; // Use the already detected hovered edge

        // Check if clicking the currently selected edge to deselect it
        const selectedVertices = new Set(partialTriangle);
        if (secondEdge && selectedVertices.has(secondEdge.v1) && selectedVertices.has(secondEdge.v2)) {
            partialTriangle = [];
            hoveredEdge = null;
            draw();
            return;
        }

        if (secondEdge) {
            const allVertices = [...partialTriangle, secondEdge.v1, secondEdge.v2];
            const uniqueVertices = [...new Set(allVertices)];

            // If we have 3 unique vertices, the two edges were adjacent and form a triangle
            if (uniqueVertices.length === 3) {
                if (!isDuplicateTriangle(uniqueVertices) && isNewTriangleValid(uniqueVertices)) {
                    const newTriangle = { vertices: uniqueVertices, color: calculateAverageColor(uniqueVertices) };
                    history.execute(new AddTriangleCommand(newTriangle));
                }
                partialTriangle = [];
                hoveredEdge = null;
                return;
            }
        }
    }

    // If an edge is selected, check for a click on an existing vertex to complete the triangle.
    if (partialTriangle.length === 2) {
        const snappedVertex = getVertexNear(worldPos);
        if (snappedVertex && !partialTriangle.includes(snappedVertex)) {
            const uniqueVertices = [...partialTriangle, snappedVertex];
            if (isNewTriangleValid(uniqueVertices)) {
                const newTriangle = { vertices: uniqueVertices, color: calculateAverageColor(uniqueVertices) };
                history.execute(new AddTriangleCommand(newTriangle));
                partialTriangle = [];
                hoveredEdge = null;
                // Action is complete, so we return to prevent fall-through logic.
                return;
            }
        }
    }

    // Snap to an existing vertex if clicking nearby
    const snappedVertex = getVertexNear(worldPos);
    const newVertex = snappedVertex || worldPos;

    // If creating a brand new vertex (not snapping), check if it's inside an existing triangle.
    // This provides earlier feedback to the user than waiting for triangle completion.
    if (!snappedVertex) {
        const containingTriangleInfo = getTriangleAt(worldPos);
        if (containingTriangleInfo) {
            showNotification("Invalid vertex: Cannot create a point inside an existing triangle.");
            return; // Abort adding this point.
        }
    }

    // Avoid adding a vertex that is already in the partial triangle
    if (partialTriangle.includes(newVertex)) {
        return;
    }

    partialTriangle.push(newVertex);

    if (partialTriangle.length === 3) {
        if (!isDuplicateTriangle(partialTriangle) && isNewTriangleValid(partialTriangle)) {
            const newTriangle = { vertices: [...partialTriangle], color: calculateAverageColor(partialTriangle) };
            history.execute(new AddTriangleCommand(newTriangle));
        }
        partialTriangle = [];
    } else {
        draw();
    }
}

function handleCanvasContextMenu(e) {
    e.preventDefault(); // Prevent the default right-click menu
    if (!backgroundImage) return;

    if (partialTriangle.length > 0) {
        // In triangle mode, right-click cancels the current triangle creation
        partialTriangle = [];
        hoveredEdge = null; // Also clear hovered edge
        draw();
        return;
    }

    // If a triangle is being hovered, remove it
    if (hoveredTriangle) {
        const index = triangles.indexOf(hoveredTriangle);
        if (index > -1) {
            const triangleToRemove = hoveredTriangle;
            hoveredTriangle = null; // Clear hover state before the redraw
            history.execute(new RemoveTriangleCommand(triangleToRemove, index));
        }
    }
}

function handleClearAll() {
    if (triangles.length === 0) return;
    history.execute(new BulkUpdateCommand({ triangles: [] }));
    partialTriangle = [];
}

function updateUndoRedoButtons() {
    undoBtn.disabled = history.undoStack.length === 0;
    redoBtn.disabled = history.redoStack.length === 0;
}

// --- New Triangle Mode Functions ---

function toggleTriangleVisibility() {
    showTriangles = !showTriangles;
    updateAllToggleButtons();
    draw();
}

function toggleWireframeVisibility() {
    showWireframe = !showWireframe;
    updateAllToggleButtons();
    draw();
}

function toggleImageVisibility() {
    showImage = !showImage;
    updateAllToggleButtons();
    draw();
}

function updateAllToggleButtons() {
    // Filled Triangles Button
    const triEye = toggleTrianglesBtn.querySelector('.icon-eye');
    const triEyeSlash = toggleTrianglesBtn.querySelector('.icon-eye-slash');
    triEye.style.display = showTriangles ? 'inline' : 'none';
    triEyeSlash.style.display = showTriangles ? 'none' : 'inline';
    toggleTrianglesBtn.title = showTriangles ? "Hide Filled Triangles (2)" : "Show Filled Triangles (2)";

    // Wireframe Button
    const wireEye = toggleWireframeBtn.querySelector('.icon-eye');
    const wireEyeSlash = toggleWireframeBtn.querySelector('.icon-eye-slash');
    wireEye.style.display = showWireframe ? 'inline' : 'none';
    wireEyeSlash.style.display = showWireframe ? 'none' : 'inline';
    toggleWireframeBtn.title = showWireframe ? "Hide Wireframe (3)" : "Show Wireframe (3)";

    // Image Button
    const imgEye = toggleImageBtn.querySelector('.icon-eye');
    const imgEyeSlash = toggleImageBtn.querySelector('.icon-eye-slash');
    imgEye.style.display = showImage ? 'inline' : 'none';
    imgEyeSlash.style.display = showImage ? 'none' : 'inline';
    toggleImageBtn.title = showImage ? "Hide Image (1)" : "Show Image (1)";
}

function downloadFile(content, filename, mimeType) {
    const dataBlob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportTriangleLayer() {
    if (!backgroundImage || triangles.length === 0) {
        alert("No triangles to export.");
        return;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = backgroundImage.width;
    exportCanvas.height = backgroundImage.height;
    const exportCtx = exportCanvas.getContext('2d');

    // Set background to transparent
    exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

    triangles.forEach(tri => {
        exportCtx.beginPath();
        exportCtx.moveTo(tri.vertices[0].x, tri.vertices[0].y);
        exportCtx.lineTo(tri.vertices[1].x, tri.vertices[1].y);
        exportCtx.lineTo(tri.vertices[2].x, tri.vertices[2].y);
        exportCtx.closePath();
        exportCtx.fillStyle = tri.color;
        exportCtx.fill();
    });

    const url = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');

    let exportFilename = 'triangles.png';
    if (imageFilename) {
        const baseName = imageFilename.substring(0, imageFilename.lastIndexOf('.')) || imageFilename;
        exportFilename = `${baseName}.triangles.png`;
    }
    link.download = exportFilename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handleExportMesh() {
    if (triangles.length === 0) {
        alert("No mesh to export.");
        return;
    }

    const vertexMap = new Map();
    const uniqueVertices = [];

    // Create a unique list of vertices and a map to their indices
    triangles.forEach(tri => {
        tri.vertices.forEach(vertex => {
            if (!vertexMap.has(vertex)) {
                vertexMap.set(vertex, uniqueVertices.length);
                uniqueVertices.push(vertex);
            }
        });
    });

    // Create triangles using indices
    const indexedTriangles = triangles.map(tri => {
        const indices = tri.vertices.map(v => vertexMap.get(v));
        return { v: indices };
    });

    const meshData = {
        vertices: uniqueVertices,
        triangles: indexedTriangles,
    };

    const dataStr = JSON.stringify(meshData, null, 2);

    let exportFilename = 'mesh.json';
    if (imageFilename) {
        const baseName = imageFilename.substring(0, imageFilename.lastIndexOf('.')) || imageFilename;
        exportFilename = `${baseName}.mesh.json`;
    }
    downloadFile(dataStr, exportFilename, 'application/json');
}

function handleImportMesh(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!backgroundImage) {
        alert("Please load an image before importing a mesh.");
        e.target.value = null;
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const meshData = JSON.parse(event.target.result);
            if (!meshData || !Array.isArray(meshData.vertices) || !Array.isArray(meshData.triangles)) throw new Error("Invalid mesh file format.");

            const newTriangles = meshData.triangles.map(triData => {
                if (!triData.v || triData.v.length !== 3) throw new Error("Invalid triangle data in mesh file.");
                const vertices = triData.v.map(index => meshData.vertices[index]);
                if (vertices.some(v => v === undefined || typeof v.x !== 'number' || typeof v.y !== 'number')) throw new Error("Invalid vertex data in mesh file.");
                return { vertices, color: calculateAverageColor(vertices) };
            });

            history.execute(new BulkUpdateCommand({ triangles: newTriangles }));
        } catch (error) {
            alert(`Error loading mesh: ${error.message}`);
        }
        e.target.value = null; // Reset file input
    };
    reader.readAsText(file);
}

function handleExportTrianglesSVG() {
    if (!backgroundImage || triangles.length === 0) {
        alert("No triangles to export.");
        return;
    }

    const width = backgroundImage.width;
    const height = backgroundImage.height;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;

    triangles.forEach(tri => {
        const pointsStr = tri.vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
        svgContent += `  <polygon points="${pointsStr}" fill="${tri.color}" />\n`;
    });

    svgContent += `</svg>`;

    let exportFilename = 'triangles.svg';
    if (imageFilename) {
        const baseName = imageFilename.substring(0, imageFilename.lastIndexOf('.')) || imageFilename;
        exportFilename = `${baseName}.triangles.svg`;
    }

    downloadFile(svgContent, exportFilename, 'image/svg+xml');
}

function handleExportWireframeSVG() {
    if (!backgroundImage || triangles.length === 0) {
        alert("No wireframe to export.");
        return;
    }

    const width = backgroundImage.width;
    const height = backgroundImage.height;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;

    triangles.forEach(tri => {
        const pointsStr = tri.vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
        // Using a fixed stroke width for SVG as it scales well.
        svgContent += `  <polygon points="${pointsStr}" fill="none" stroke="black" stroke-width="1" stroke-linejoin="round" />\n`;
    });

    svgContent += `</svg>`;

    let exportFilename = 'wireframe.svg';
    if (imageFilename) {
        const baseName = imageFilename.substring(0, imageFilename.lastIndexOf('.')) || imageFilename;
        exportFilename = `${baseName}.wireframe.svg`;
    }

    downloadFile(svgContent, exportFilename, 'image/svg+xml');
}

function handleExportCombinedSVG() {
    if (!backgroundImage || triangles.length === 0) {
        alert("No mesh to export.");
        return;
    }

    const width = backgroundImage.width;
    const height = backgroundImage.height;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;

    // --- Define a clip-path to clip the seam lines to the exact mesh boundary ---
    svgContent += `  <defs>\n`;
    svgContent += `    <clipPath id="mesh-clip-path">\n`;
    // The clipping path is the union of all triangle shapes.
    // The fill color doesn't matter for a clip-path, only the geometry.
    triangles.forEach(tri => {
        const pointsStr = tri.vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
        svgContent += `        <polygon points="${pointsStr}" />\n`;
    });
    svgContent += `    </clipPath>\n`;
    svgContent += `  </defs>\n\n`;

    // 1. Find unique vertices
    const vertexMap = new Map();
    const uniqueVertices = [];
    triangles.forEach(tri => {
        tri.vertices.forEach(vertex => {
            if (!vertexMap.has(vertex)) {
                vertexMap.set(vertex, uniqueVertices.length);
                uniqueVertices.push(vertex);
            }
        });
    });

    // 2. Find all unique edges and their adjacent triangles
    const edgeMap = new Map();
    triangles.forEach(tri => {
        for (let i = 0; i < 3; i++) {
            const v1 = tri.vertices[i];
            const v2 = tri.vertices[(i + 1) % 3];
            const idx1 = vertexMap.get(v1);
            const idx2 = vertexMap.get(v2);
            const key = Math.min(idx1, idx2) + '-' + Math.max(idx1, idx2);

            if (!edgeMap.has(key)) {
                edgeMap.set(key, []);
            }
            edgeMap.get(key).push(tri);
        }
    });

    // Helper to average RGB colors
    const parseRgb = (rgb) => rgb.match(/\d+/g).map(Number);
    const averageColors = (c1, c2) => {
        const [r1, g1, b1] = parseRgb(c1);
        const [r2, g2, b2] = parseRgb(c2);
        return `rgb(${Math.round((r1 + r2) / 2)}, ${Math.round((g1 + g2) / 2)}, ${Math.round((b1 + b2) / 2)})`;
    };

    // 3. Create seam-filling lines and apply the clip-path to them
    svgContent += `  <g id="seam-lines" clip-path="url(#mesh-clip-path)">\n`;
    edgeMap.forEach((adjacentTris, key) => {
        // Only create a seam line if the edge is shared by exactly two triangles
        if (adjacentTris.length === 2) {
            const [idx1, idx2] = key.split('-').map(Number);
            const v1 = uniqueVertices[idx1];
            const v2 = uniqueVertices[idx2];
            const strokeColor = averageColors(adjacentTris[0].color, adjacentTris[1].color);
            svgContent += `    <line x1="${v1.x.toFixed(2)}" y1="${v1.y.toFixed(2)}" x2="${v2.x.toFixed(2)}" y2="${v2.y.toFixed(2)}" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />\n`;
        }
    });
    svgContent += `  </g>\n`;

    // Group for filled triangles (now without their own stroke)
    svgContent += `  <g id="filled-triangles">\n`;
    triangles.forEach((tri, index) => {
        const pointsStr = tri.vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
        svgContent += `    <polygon id="fill-triangle-${index}" points="${pointsStr}" fill="${tri.color}" />\n`;
    });
    svgContent += `  </g>\n`;

    // Group for wireframe mesh
    // The wireframe is included but hidden by default for easier use in vector editors.
    svgContent += `  <g id="wireframe-mesh" display="none">\n`;
    triangles.forEach((tri, index) => {
        const pointsStr = tri.vertices.map(v => `${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' ');
        svgContent += `    <polygon id="mesh-triangle-${index}" points="${pointsStr}" fill="none" stroke="black" stroke-width="1" stroke-linejoin="round" />\n`;
    });
    svgContent += `  </g>\n`;

    svgContent += `</svg>`;

    let exportFilename = 'combined.svg';
    if (imageFilename) {
        const baseName = imageFilename.substring(0, imageFilename.lastIndexOf('.')) || imageFilename;
        exportFilename = `${baseName}.combined.svg`;
    }

    downloadFile(svgContent, exportFilename, 'image/svg+xml');
}

function findTrianglesWithVertex(vertex) {
    return triangles.filter(tri => tri.vertices.includes(vertex));
}

function getVertexNear(worldPos) {
    const hitRadiusInWorld = HIT_RADIUS / scale;
    for (const tri of triangles) {
        for (const vertex of tri.vertices) {
            const distance = Math.sqrt((worldPos.x - vertex.x) ** 2 + (worldPos.y - vertex.y) ** 2);
            if (distance < hitRadiusInWorld) {
                return vertex; // Return the existing vertex object for perfect snapping
            }
        }
    }
    return null;
}

// --- Intersection and Geometry Helpers ---

// To find orientation of ordered triplet (p, q, r).
// 0 --> p, q and r are collinear
// 1 --> Clockwise
// 2 --> Counterclockwise
function orientation(p, q, r) {
    if (!p || !q || !r) return 0;
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 1e-10) return 0; // Use a small epsilon for float comparisons
    return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

// Given three collinear points p, q, r, the function checks if
// point q lies on line segment 'pr'
function onSegment(p, q, r) {
    return (
        q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
    );
}

function segmentsIntersect(p1, q1, p2, q2) {
    // Ignore segments that share an endpoint, as they cannot cross
    if (p1 === p2 || p1 === q2 || q1 === p2 || q1 === q2) {
        return false;
    }

    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    // General case: segments cross each other
    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    // Special Cases for collinear intersections
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

function checkNewTriangleForIntersections(newVertices) {
    const newEdges = [
        { v1: newVertices[0], v2: newVertices[1] }, { v1: newVertices[1], v2: newVertices[2] }, { v1: newVertices[2], v2: newVertices[0] },
    ];
    const allExistingEdges = triangles.flatMap(tri => [
        { v1: tri.vertices[0], v2: tri.vertices[1] }, { v1: tri.vertices[1], v2: tri.vertices[2] }, { v1: tri.vertices[2], v2: tri.vertices[0] },
    ]);

    return newEdges.some(newEdge => allExistingEdges.some(existingEdge => segmentsIntersect(newEdge.v1, newEdge.v2, existingEdge.v1, existingEdge.v2)));
}

function isNewTriangleValid(newVertices) {
    // Check 1: Edge intersections
    if (checkNewTriangleForIntersections(newVertices)) {
        showNotification("Invalid triangle: Edges would cross.");
        return false;
    }

    // Check 2: Containment. This prevents a new triangle from being drawn
    // inside an existing one, or vice-versa.
    const newVerticesSet = new Set(newVertices);

    for (const oldTri of triangles) {
        const oldVerticesSet = new Set(oldTri.vertices);

        // Check if any vertex of the new triangle is inside an old triangle
        // (and is not a shared vertex). This prevents creating a new triangle
        // by picking a point inside an existing one.
        for (const newVert of newVertices) {
            if (!oldVerticesSet.has(newVert) && pointInTriangle(newVert, oldTri.vertices[0], oldTri.vertices[1], oldTri.vertices[2])) {
                showNotification("Invalid triangle: New vertex is inside an existing triangle.");
                return false;
            }
        }

        // Check if any vertex of an old triangle is inside the new triangle
        // (and is not a shared vertex). This prevents creating a new triangle
        // that engulfs an existing vertex.
        for (const oldVert of oldTri.vertices) {
            if (!newVerticesSet.has(oldVert) && pointInTriangle(oldVert, newVertices[0], newVertices[1], newVertices[2])) {
                showNotification("Invalid triangle: Engulfs an existing vertex.");
                return false;
            }
        }
    }

    return true; // Triangle is valid
}

// --- New Edge Selection and Geometry Helpers ---

function distanceToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt((p.x - projection.x) ** 2 + (p.y - projection.y) ** 2);
}

function getEdgeNear(worldPos) {
    const hitRadiusInWorld = HIT_RADIUS / scale;
    let closestEdge = null;
    let minDistance = Infinity;

    for (const tri of triangles) {
        const edges = [
            { v1: tri.vertices[0], v2: tri.vertices[1] },
            { v1: tri.vertices[1], v2: tri.vertices[2] },
            { v1: tri.vertices[2], v2: tri.vertices[0] },
        ];
        for (const edge of edges) {
            const distance = distanceToSegment(worldPos, edge.v1, edge.v2);
            if (distance < minDistance) {
                minDistance = distance;
                closestEdge = edge;
            }
        }
    }

    if (closestEdge && minDistance < hitRadiusInWorld) {
        return closestEdge;
    }
    return null;
}

function isDuplicateTriangle(newVertices) {
    const newSet = new Set(newVertices);
    return triangles.some(tri => {
        const existingSet = new Set(tri.vertices);
        return existingSet.size === newSet.size && [...existingSet].every(v => newSet.has(v));
    });
}

function getTriangleAt(worldPos) {
    // Iterate backwards to find the top-most triangle first
    for (let i = triangles.length - 1; i >= 0; i--) {
        const tri = triangles[i];
        if (pointInTriangle(worldPos, tri.vertices[0], tri.vertices[1], tri.vertices[2])) {
            return { triangle: tri, index: i };
        }
    }
    return null;
}

// Uses barycentric coordinates to check if a point is inside a triangle
function pointInTriangle(p, p0, p1, p2) {
    const A = 0.5 * (-p1.y * p2.x + p0.y * (-p1.x + p2.x) + p0.x * (p1.y - p2.y) + p1.x * p2.y);
    const sign = A < 0 ? -1 : 1;
    const s = (p0.y * p2.x - p0.x * p2.y + (p2.y - p0.y) * p.x + (p0.x - p2.x) * p.y) * sign;
    const t = (p0.x * p1.y - p0.y * p1.x + (p0.y - p1.y) * p.x + (p1.x - p0.x) * p.y) * sign;
    return s >= 0 && t >= 0 && (s + t) <= 2 * A * sign;
}

function calculateAverageColor(vertices) {
    if (!originalImageData) return 'rgb(128,128,128)'; // Fallback

    const [v1, v2, v3] = vertices;
    const minX = Math.floor(Math.min(v1.x, v2.x, v3.x));
    const maxX = Math.ceil(Math.max(v1.x, v2.x, v3.x));
    const minY = Math.floor(Math.min(v1.y, v2.y, v3.y));
    const maxY = Math.ceil(Math.max(v1.y, v2.y, v3.y));

    let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
    const { width: imgWidth, height: imgHeight, data } = originalImageData;

    for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
            if (x < 0 || x >= imgWidth || y < 0 || y >= imgHeight) continue;
            if (pointInTriangle({ x, y }, v1, v2, v3)) {
                const index = (y * imgWidth + x) * 4;
                totalR += data[index];
                totalG += data[index + 1];
                totalB += data[index + 2];
                pixelCount++;
            }
        }
    }

    if (pixelCount === 0) return 'rgb(128,128,128)'; // Fallback for empty or line triangles
    return `rgb(${Math.round(totalR / pixelCount)}, ${Math.round(totalG / pixelCount)}, ${Math.round(totalB / pixelCount)})`;
}

// --- New Pan and Zoom Handlers ---

function handleWheel(e) {
    e.preventDefault();
    if (!backgroundImage) return;

    // On most systems, pinch-to-zoom on a trackpad fires a wheel event with the ctrlKey pressed.
    // We'll use this to distinguish between zooming and panning.
    if (e.ctrlKey) {
        // --- ZOOM --- (Pinch gesture or Ctrl + mouse wheel)
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * ZOOM_SENSITIVITY);
        const mousePos = getMousePos(canvas, e);
        const worldPosBeforeZoom = screenToWorld(mousePos);
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoom));

        // Update the pan offset to keep the point under the mouse fixed during zoom
        panOffset.x = mousePos.x - worldPosBeforeZoom.x * newScale;
        panOffset.y = mousePos.y - worldPosBeforeZoom.y * newScale;
        scale = newScale;
    } else {
        // --- PAN --- (Two-finger swipe on trackpad or regular mouse wheel scroll)
        panOffset.x -= e.deltaX;
        panOffset.y -= e.deltaY;
    }

    draw();
}

function handleMouseDown(e) {
    if (e.button !== 0) return; // Only left-click
    didStartDragOnVertex = false; // Reset on every mousedown

    const worldPos = screenToWorld(getMousePos(canvas, e));
    const vertexToDrag = getVertexNear(worldPos);

    if (vertexToDrag) {
        // Start dragging a vertex
        didStartDragOnVertex = true;
        isDraggingVertex = true;
        vertexBeingDragged = vertexToDrag;
        dragStartPos = { x: vertexToDrag.x, y: vertexToDrag.y };
        canvas.style.cursor = 'grabbing';
    } else {
        // Start panning
        isPanning = true;
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
        canvas.style.cursor = 'grabbing';
    }
}

function handleMouseUp(e) {
    if (e.button !== 0) return;

    if (isDraggingVertex) {
        if (isInvalidDragPosition) {
            // Revert the move
            vertexBeingDragged.x = dragStartPos.x;
            vertexBeingDragged.y = dragStartPos.y;
            showNotification("Invalid vertex position: Edges would cross.");
        } else {
            const endPos = { x: vertexBeingDragged.x, y: vertexBeingDragged.y };
            // Only create a command if the position actually changed to avoid empty undo steps
            if (dragStartPos.x !== endPos.x || dragStartPos.y !== endPos.y) {
                const command = new MoveVertexCommand(vertexBeingDragged, dragStartPos, endPos);
                // We don't call history.execute because it calls draw(). We want to call draw() once after all state is updated.
                command.execute();
                history.undoStack.push(command);
                history.redoStack.length = 0;
                updateUndoRedoButtons();
            }
        }
        isDraggingVertex = false;
        vertexBeingDragged = null;
        isInvalidDragPosition = false; // reset state
        draw(); // Redraw with final colors
    }

    isPanning = false;
    canvas.style.cursor = 'copy'; // Reset to default
}

function handleMouseLeave() {
    isPanning = false;
    isDraggingVertex = false; // Also cancel drag if mouse leaves canvas
    canvas.style.cursor = 'copy';

    if (hoveredEdge || hoveredVertex || hoveredTriangle) {
        hoveredEdge = null;
        hoveredVertex = null;
        hoveredTriangle = null;
        draw();
    }
}

function handleMouseMove(e) {
    if (isDraggingVertex) {
        const worldPos = screenToWorld(getMousePos(canvas, e));
        vertexBeingDragged.x = worldPos.x;
        vertexBeingDragged.y = worldPos.y;

        // --- Intersection and Overlap check during drag ---
        let isInvalid = false;
        const affectedTriangles = findTrianglesWithVertex(vertexBeingDragged);
        const otherTriangles = triangles.filter(tri => !affectedTriangles.includes(tri));

        // Check 1: Edge intersections (optimized)
        const connectedEdges = [];
        affectedTriangles.forEach(tri => {
            tri.vertices.forEach(v => {
                if (v !== vertexBeingDragged) {
                    const edgeExists = connectedEdges.some(e => e.v2 === v);
                    if (!edgeExists) {
                        connectedEdges.push({ v1: vertexBeingDragged, v2: v });
                    }
                }
            });
        });

        const allOtherEdges = otherTriangles.flatMap(tri => [{ v1: tri.vertices[0], v2: tri.vertices[1] }, { v1: tri.vertices[1], v2: tri.vertices[2] }, { v1: tri.vertices[2], v2: tri.vertices[0] }]);

        if (connectedEdges.some(ce => allOtherEdges.some(oe => segmentsIntersect(ce.v1, ce.v2, oe.v1, oe.v2)))) {
            isInvalid = true;
        }

        // Check 2: Containment
        if (!isInvalid) {
            for (const affectedTri of affectedTriangles) {
                if (isInvalid) break;
                const affectedVerticesSet = new Set(affectedTri.vertices);
                for (const otherTri of otherTriangles) {
                    const otherVerticesSet = new Set(otherTri.vertices);
                    // Check if any vertex of the other triangle is inside the (moved) affected triangle
                    for (const otherVert of otherTri.vertices) {
                        if (!affectedVerticesSet.has(otherVert) && pointInTriangle(otherVert, affectedTri.vertices[0], affectedTri.vertices[1], affectedTri.vertices[2])) {
                            isInvalid = true;
                            break;
                        }
                    }
                    if (isInvalid) break;
                    // Check if any vertex of the affected triangle is inside the other triangle
                    for (const affectedVert of affectedTri.vertices) {
                        if (!otherVerticesSet.has(affectedVert) && pointInTriangle(affectedVert, otherTri.vertices[0], otherTri.vertices[1], otherTri.vertices[2])) {
                            isInvalid = true;
                            break;
                        }
                    }
                    if (isInvalid) break;
                }
            }
        }

        isInvalidDragPosition = isInvalid;

        draw(); // Redraw with vertex at new position, but without expensive color recalculation
    } else if (isPanning) {
        panOffset.x = e.clientX - panStart.x;
        panOffset.y = e.clientY - panStart.y;
        draw();
    } else {
        // --- Hover Logic ---
        const worldPos = screenToWorld(getMousePos(canvas, e));
        const newHoveredVertex = getVertexNear(worldPos);
        const canSelectEdge = (partialTriangle.length === 0 || partialTriangle.length === 1 || partialTriangle.length === 2) && !newHoveredVertex;
        const newHoveredEdge = canSelectEdge ? getEdgeNear(worldPos) : null;

        let newHoveredTriangle = null;
        // Only check for triangle hover if not creating a triangle and not over a vertex/edge
        if (partialTriangle.length === 0 && !newHoveredVertex && !newHoveredEdge) {
            const found = getTriangleAt(worldPos);
            if (found) {
                newHoveredTriangle = found.triangle;
            }
        }

        if (newHoveredVertex !== hoveredVertex || newHoveredEdge !== hoveredEdge || newHoveredTriangle !== hoveredTriangle) {
            hoveredVertex = newHoveredVertex;
            hoveredEdge = newHoveredEdge;
            hoveredTriangle = newHoveredTriangle;
            // Update cursor: not-allowed for removal, grab for vertex, pointer for edge
            canvas.style.cursor = hoveredTriangle ? 'not-allowed' : (hoveredVertex ? 'grab' : (hoveredEdge ? 'pointer' : 'copy'));
            draw();
        }
    }
}


// --- Initial Setup ---

function resizeCanvas() {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Adjust pan offset to keep the view centered on resize.
    // This is corrected when an image is loaded and centered.
    panOffset.x += (canvas.width - oldWidth) / 2;
    panOffset.y += (canvas.height - oldHeight) / 2;

    draw();
}

// --- Event Handlers for Modal ---
function openHelpModal() {
    helpModal.style.display = 'block';
}

function closeHelpModal() {
    helpModal.style.display = 'none';
}

helpBtn.addEventListener('click', openHelpModal);
closeHelpBtn.addEventListener('click', closeHelpModal);

// Close modal if user clicks outside of the content
window.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelpModal();
});

imageLoader.addEventListener('change', handleImageLoad);
undoBtn.addEventListener('click', () => history.undo());
redoBtn.addEventListener('click', () => history.redo());
clearAllBtn.addEventListener('click', handleClearAll);
toggleTrianglesBtn.addEventListener('click', toggleTriangleVisibility);
toggleWireframeBtn.addEventListener('click', toggleWireframeVisibility);
toggleImageBtn.addEventListener('click', toggleImageVisibility);
exportTrianglesBtn.addEventListener('click', exportTriangleLayer);
exportTrianglesSvgBtn.addEventListener('click', handleExportTrianglesSVG);
exportWireframeSvgBtn.addEventListener('click', handleExportWireframeSVG);
exportCombinedSvgBtn.addEventListener('click', handleExportCombinedSVG);
importMesh.addEventListener('change', handleImportMesh);
exportMeshBtn.addEventListener('click', handleExportMesh);

window.addEventListener('keydown', (e) => {
    // Use `e.metaKey` for Command key on macOS
    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            history.undo();
        } else if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            history.redo();
        }
    } else if (e.key === 'Escape') {
        if (helpModal.style.display === 'block') {
            closeHelpModal();
        } else if (partialTriangle.length > 0) {
            partialTriangle = [];
            hoveredEdge = null;
            draw();
        }
    } else if (e.key === '?') {
        if (helpModal.style.display === 'block') {
            closeHelpModal();
        } else {
            openHelpModal();
        }
    } else if (e.target.tagName.toLowerCase() !== 'input') { // Prevent shortcuts when typing in inputs
        switch (e.key.toLowerCase()) {
            case '1':
                toggleImageVisibility();
                break;
            case '2':
                toggleTriangleVisibility();
                break;
            case '3':
                toggleWireframeVisibility();
                break;
        }
    }
});

// Add event listeners for pan, zoom, and point interaction
canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('contextmenu', handleCanvasContextMenu);
canvas.addEventListener('wheel', handleWheel, { passive: false });
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseLeave);
canvas.addEventListener('mousemove', handleMouseMove);

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Set initial size and draw placeholder
updateUndoRedoButtons(); // Set initial button state
updateAllToggleButtons(); // Set initial visibility button states
