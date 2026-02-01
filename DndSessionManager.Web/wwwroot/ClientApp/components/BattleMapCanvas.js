import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'
import { useLineOfSight } from '../composables/useLineOfSight.js'
import Konva from 'konva'

export default {
	name: 'BattleMapCanvas',
	template: `
		<div>
			<div ref="containerRef" class="battle-map-canvas" style="width: 100%; height: 600px; background: #1a1a1a; border-radius: 5px; overflow: hidden;"></div>
		</div>
	`,
	props: {
		sessionId: { type: String, required: true },
		userId: { type: String, required: true },
		isMaster: { type: Boolean, required: true },
		connection: { type: Object, required: false },
		currentTool: { type: String, default: 'select' },
		wallType: { type: String, default: 'Solid' },
		fogMode: { type: String, default: 'reveal' }
	},
	emits: ['token-moved'],
	setup(props, { emit }) {
		const store = useBattleMapStore()
		const { calculateVisibleCells } = useLineOfSight()
		const containerRef = ref(null)

		let stage = null
		let backgroundLayer = null
		let gridLayer = null
		let wallsLayer = null
		let fogLayer = null
		let tokensLayer = null

		const tokenShapes = new Map() // tokenId -> Konva.Group
		const wallShapes = new Map() // wallId -> Konva.Line

		// Wall drawing state
		const isDrawingWall = ref(false)
		const wallStartPoint = ref(null)
		let tempWallLine = null

		// Fog drawing state
		const isDrawingFog = ref(false)
		const fogBrushRadius = ref(2) // cells
		const fogPaintedCells = new Set() // Track cells painted in current stroke

		// Movement throttling
		const MOVE_THROTTLE_MS = 50 // 20 updates/sec max
		const lastMoveTime = new Map() // tokenId -> timestamp
		const pendingMoves = new Map() // tokenId -> {x, y}

		// Canvas dimensions
		const canvasWidth = computed(() => store.grid.width * store.grid.cellSizePixels)
		const canvasHeight = computed(() => store.grid.height * store.grid.cellSizePixels)

		function initializeKonva() {
			if (!containerRef.value) return

			const container = containerRef.value
			const containerWidth = container.clientWidth
			const containerHeight = container.clientHeight

			// Create stage
			stage = new Konva.Stage({
				container: containerRef.value,
				width: containerWidth,
				height: containerHeight,
				draggable: false
			})

			// Create layers (order matters for z-index)
			backgroundLayer = new Konva.Layer({ listening: false })
			gridLayer = new Konva.Layer({ listening: false })
			wallsLayer = new Konva.Layer({ listening: false })
			fogLayer = new Konva.Layer({ listening: false })
			tokensLayer = new Konva.Layer()

			stage.add(backgroundLayer)
			stage.add(gridLayer)
			stage.add(wallsLayer)
			stage.add(fogLayer)
			stage.add(tokensLayer)

			// Draw initial content
			drawBackground()
			drawGrid()
			drawTokens()
			drawWalls()
			drawFogOfWar()

			// Setup zoom and pan
			setupZoomAndPan()

			// Setup wall drawing
			setupWallDrawing()

			// Setup fog drawing
			setupFogDrawing()

			// Center viewport
			centerViewport()
		}

		function drawBackground() {
			if (!backgroundLayer) return

			backgroundLayer.destroyChildren()

			const background = new Konva.Rect({
				x: 0,
				y: 0,
				width: canvasWidth.value,
				height: canvasHeight.value,
				fill: store.background.color || '#2c3e50'
			})

			backgroundLayer.add(background)
			backgroundLayer.batchDraw()
		}

		function drawGrid() {
			if (!gridLayer) return

			gridLayer.destroyChildren()

			const cellSize = store.grid.cellSizePixels
			const width = canvasWidth.value
			const height = canvasHeight.value

			// Vertical lines
			for (let i = 0; i <= store.grid.width; i++) {
				const line = new Konva.Line({
					points: [i * cellSize, 0, i * cellSize, height],
					stroke: '#34495e',
					strokeWidth: 1,
					opacity: 0.5
				})
				gridLayer.add(line)
			}

			// Horizontal lines
			for (let i = 0; i <= store.grid.height; i++) {
				const line = new Konva.Line({
					points: [0, i * cellSize, width, i * cellSize],
					stroke: '#34495e',
					strokeWidth: 1,
					opacity: 0.5
				})
				gridLayer.add(line)
			}

			gridLayer.batchDraw()

			// Cache grid for performance
			gridLayer.cache()
		}

		function drawTokens() {
			if (!tokensLayer) return

			// Remove tokens that no longer exist
			for (const [tokenId, shape] of tokenShapes.entries()) {
				if (!store.tokens[tokenId]) {
					shape.destroy()
					tokenShapes.delete(tokenId)
				}
			}

			// Add or update tokens
			for (const token of store.tokensList) {
				// Check visibility based on fog of war
				const isVisible = isTokenVisibleToPlayer(token)

				if (tokenShapes.has(token.id)) {
					const shape = tokenShapes.get(token.id)
					shape.visible(isVisible)
					updateTokenShape(token)
				} else if (isVisible) {
					createTokenShape(token)
				}
			}

			tokensLayer.batchDraw()
		}

		function createTokenShape(token) {
			const cellSize = store.grid.cellSizePixels
			const radius = (cellSize * token.size) / 2 - 5

			const group = new Konva.Group({
				x: token.x * cellSize + cellSize / 2,
				y: token.y * cellSize + cellSize / 2,
				draggable: canDragToken(token)
			})

			// Circle background
			const circle = new Konva.Circle({
				x: 0,
				y: 0,
				radius: radius,
				fill: token.color,
				stroke: '#ecf0f1',
				strokeWidth: 3
			})

			// Token name text
			const text = new Konva.Text({
				x: -radius,
				y: radius + 5,
				width: radius * 2,
				text: token.name,
				fontSize: 12,
				fontFamily: 'Arial',
				fill: '#ecf0f1',
				align: 'center'
			})

			group.add(circle)
			group.add(text)

			// Setup drag events
			if (canDragToken(token)) {
				let originalPos = { x: token.x, y: token.y }

				group.on('dragstart', () => {
					originalPos = { x: token.x, y: token.y }
					group.moveToTop()
					circle.stroke('#3498db')
					circle.strokeWidth(4)
					tokensLayer.batchDraw()
				})

				group.on('dragmove', () => {
					// Visual feedback during drag
					const cellSize = store.grid.cellSizePixels
					const snappedPos = snapToGrid(group.x(), group.y())

					// Show ghost position
					group.x(snappedPos.x * cellSize + cellSize / 2)
					group.y(snappedPos.y * cellSize + cellSize / 2)
				})

				group.on('dragend', async () => {
					const cellSize = store.grid.cellSizePixels
					const snappedPos = snapToGrid(group.x(), group.y())

					// Reset stroke
					circle.stroke('#ecf0f1')
					circle.strokeWidth(3)

					// Snap to grid
					group.x(snappedPos.x * cellSize + cellSize / 2)
					group.y(snappedPos.y * cellSize + cellSize / 2)

					// Optimistic update
					store.moveToken(token.id, snappedPos.x, snappedPos.y)

					// Send to server (throttled)
					try {
						await sendTokenMove(token.id, snappedPos.x, snappedPos.y)

						// Auto-reveal fog of war for player tokens
						await autoRevealOnTokenMove(token, snappedPos.x, snappedPos.y)
					} catch (err) {
						// Rollback on error
						store.moveToken(token.id, originalPos.x, originalPos.y)
						updateTokenShape(token)
					}

					tokensLayer.batchDraw()
				})

				// Click to select
				group.on('click tap', () => {
					store.setSelectedToken(token.id)
					highlightSelectedToken()
				})
			}

			tokenShapes.set(token.id, group)
			tokensLayer.add(group)
		}

		function updateTokenShape(token) {
			const shape = tokenShapes.get(token.id)
			if (!shape) return

			const cellSize = store.grid.cellSizePixels
			const radius = (cellSize * token.size) / 2 - 5

			shape.x(token.x * cellSize + cellSize / 2)
			shape.y(token.y * cellSize + cellSize / 2)

			const circle = shape.findOne('Circle')
			if (circle) {
				circle.radius(radius)
				circle.fill(token.color)
			}

			const text = shape.findOne('Text')
			if (text) {
				text.text(token.name)
				text.x(-radius)
				text.width(radius * 2)
			}
		}

		function highlightSelectedToken() {
			// Reset all tokens
			for (const shape of tokenShapes.values()) {
				const circle = shape.findOne('Circle')
				if (circle) {
					circle.stroke('#ecf0f1')
					circle.strokeWidth(3)
				}
			}

			// Highlight selected
			if (store.selectedTokenId) {
				const shape = tokenShapes.get(store.selectedTokenId)
				if (shape) {
					const circle = shape.findOne('Circle')
					if (circle) {
						circle.stroke('#f39c12')
						circle.strokeWidth(5)
					}
				}
			}

			tokensLayer.batchDraw()
		}

		function drawWalls() {
			if (!wallsLayer) return

			// Remove walls that no longer exist
			for (const [wallId, shape] of wallShapes.entries()) {
				if (!store.walls[wallId]) {
					shape.destroy()
					wallShapes.delete(wallId)
				}
			}

			// Add or update walls
			for (const wall of store.wallsList) {
				if (!wallShapes.has(wall.id)) {
					createWallShape(wall)
				}
			}

			wallsLayer.batchDraw()
		}

		function createWallShape(wall) {
			const cellSize = store.grid.cellSizePixels

			const line = new Konva.Line({
				points: [
					wall.x1 * cellSize,
					wall.y1 * cellSize,
					wall.x2 * cellSize,
					wall.y2 * cellSize
				],
				stroke: wall.type === 'Solid' ? '#e74c3c' : '#f39c12',
				strokeWidth: 4,
				lineCap: 'round'
			})

			wallShapes.set(wall.id, line)
			wallsLayer.add(line)
		}

		function drawFogOfWar() {
			if (!fogLayer) return

			fogLayer.destroyChildren()

			// Only render fog if enabled
			if (!store.fogOfWar.enabled) {
				fogLayer.batchDraw()
				return
			}

			const cellSize = store.grid.cellSizePixels
			const width = canvasWidth.value
			const height = canvasHeight.value

			// Create full black rectangle covering the entire map
			const fogRect = new Konva.Rect({
				x: 0,
				y: 0,
				width: width,
				height: height,
				fill: 'black',
				opacity: 0.85
			})

			fogLayer.add(fogRect)

			// Create a group for revealed cells with destination-out composite
			const revealedGroup = new Konva.Group({
				globalCompositeOperation: 'destination-out'
			})

			// Draw revealed cells as white rectangles (will "cut out" from fog)
			store.fogOfWar.revealedCells.forEach(cell => {
				const revealedRect = new Konva.Rect({
					x: cell.x * cellSize,
					y: cell.y * cellSize,
					width: cellSize,
					height: cellSize,
					fill: 'white',
					opacity: 1
				})

				revealedGroup.add(revealedRect)
			})

			fogLayer.add(revealedGroup)
			fogLayer.batchDraw()

			// Cache for performance
			fogLayer.cache()
		}

		function snapToGridIntersection(pixelX, pixelY) {
			const cellSize = store.grid.cellSizePixels
			const gridX = Math.round(pixelX / cellSize)
			const gridY = Math.round(pixelY / cellSize)

			// Clamp to grid bounds (intersections go from 0 to width/height)
			const clampedX = Math.max(0, Math.min(store.grid.width, gridX))
			const clampedY = Math.max(0, Math.min(store.grid.height, gridY))

			return { x: clampedX, y: clampedY }
		}

		function setupWallDrawing() {
			if (!stage || !wallsLayer) return

			stage.on('click', (e) => {
				// Only handle wall drawing in wall mode
				if (props.currentTool !== 'wall' || !props.isMaster) return

				// Ignore clicks on tokens
				if (e.target !== stage && e.target.getLayer() === tokensLayer) return

				const pos = stage.getPointerPosition()
				const transform = stage.getAbsoluteTransform().copy().invert()
				const localPos = transform.point(pos)

				const snapped = snapToGridIntersection(localPos.x, localPos.y)

				if (!isDrawingWall.value) {
					// Start drawing wall
					wallStartPoint.value = snapped
					isDrawingWall.value = true

					// Create temporary line
					const cellSize = store.grid.cellSizePixels
					tempWallLine = new Konva.Line({
						points: [
							snapped.x * cellSize,
							snapped.y * cellSize,
							snapped.x * cellSize,
							snapped.y * cellSize
						],
						stroke: props.wallType === 'Solid' ? '#e74c3c' : '#f39c12',
						strokeWidth: 4,
						lineCap: 'round',
						opacity: 0.6,
						dash: [10, 5]
					})

					wallsLayer.add(tempWallLine)
					wallsLayer.batchDraw()
				} else {
					// Finish drawing wall
					finishWallDrawing(snapped)
				}
			})

			stage.on('mousemove', () => {
				if (!isDrawingWall.value || !tempWallLine) return

				const pos = stage.getPointerPosition()
				const transform = stage.getAbsoluteTransform().copy().invert()
				const localPos = transform.point(pos)

				const snapped = snapToGridIntersection(localPos.x, localPos.y)
				const cellSize = store.grid.cellSizePixels

				tempWallLine.points([
					wallStartPoint.value.x * cellSize,
					wallStartPoint.value.y * cellSize,
					snapped.x * cellSize,
					snapped.y * cellSize
				])

				wallsLayer.batchDraw()
			})
		}

		async function finishWallDrawing(endPoint) {
			if (!wallStartPoint.value) return

			const start = wallStartPoint.value

			// Don't create wall if start and end are the same
			if (start.x === endPoint.x && start.y === endPoint.y) {
				cancelWallDrawing()
				return
			}

			// Create wall data
			const wallData = {
				x1: start.x,
				y1: start.y,
				x2: endPoint.x,
				y2: endPoint.y,
				type: props.wallType,
				blocksLight: true,
				blocksMovement: true
			}

			// Remove temporary line
			if (tempWallLine) {
				tempWallLine.destroy()
				tempWallLine = null
			}

			// Reset state
			isDrawingWall.value = false
			wallStartPoint.value = null

			// Send to server
			try {
				if (props.connection) {
					await props.connection.invoke('AddWall', props.sessionId, props.userId, wallData)
				}
			} catch (err) {
				console.error('Error adding wall:', err)
			}

			wallsLayer.batchDraw()
		}

		function cancelWallDrawing() {
			if (tempWallLine) {
				tempWallLine.destroy()
				tempWallLine = null
			}

			isDrawingWall.value = false
			wallStartPoint.value = null
			wallsLayer.batchDraw()
		}

		function setupFogDrawing() {
			if (!stage) return

			stage.on('mousedown', (e) => {
				// Only handle fog drawing in fog mode
				if (props.currentTool !== 'fog' || !props.isMaster) return

				// Ignore clicks on tokens
				if (e.target !== stage && e.target.getLayer() === tokensLayer) return

				isDrawingFog.value = true
				fogPaintedCells.clear()

				// Paint initial cell
				paintFogCells(e)
			})

			stage.on('mousemove', (e) => {
				if (!isDrawingFog.value) return

				// Paint cells as we drag
				paintFogCells(e)
			})

			stage.on('mouseup', async () => {
				if (!isDrawingFog.value) return

				isDrawingFog.value = false

				// Send accumulated cells to server
				if (fogPaintedCells.size > 0) {
					const cells = Array.from(fogPaintedCells).map(key => {
						const [x, y] = key.split(',').map(Number)
						return { x, y }
					})

					try {
						if (props.connection) {
							if (props.fogMode === 'reveal') {
								await props.connection.invoke('RevealArea', props.sessionId, props.userId, cells)
							} else {
								await props.connection.invoke('ShroudArea', props.sessionId, props.userId, cells)
							}
						}
					} catch (err) {
						console.error('Error updating fog:', err)
					}
				}

				fogPaintedCells.clear()
			})
		}

		function paintFogCells(e) {
			const pos = stage.getPointerPosition()
			const transform = stage.getAbsoluteTransform().copy().invert()
			const localPos = transform.point(pos)

			const cellSize = store.grid.cellSizePixels
			const centerX = Math.floor(localPos.x / cellSize)
			const centerY = Math.floor(localPos.y / cellSize)

			// Paint cells in a circular brush
			const radius = fogBrushRadius.value
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					// Circular brush shape
					if (dx * dx + dy * dy <= radius * radius) {
						const x = centerX + dx
						const y = centerY + dy

						// Check bounds
						if (x >= 0 && x < store.grid.width && y >= 0 && y < store.grid.height) {
							const cellKey = `${x},${y}`

							// Track cell for batch update
							fogPaintedCells.add(cellKey)

							// Optimistic update
							if (props.fogMode === 'reveal') {
								store.revealCells([{ x, y }])
							} else {
								store.shroudCells([{ x, y }])
							}
						}
					}
				}
			}
		}

		async function autoRevealOnTokenMove(token, x, y) {
			// Only auto-reveal if:
			// 1. Fog is enabled
			// 2. Token is not DM-only
			// 3. Token has a vision radius (default 10 if not specified)
			if (!store.fogOfWar.enabled || token.isDmOnly) {
				return
			}

			try {
				// Calculate visible cells using LOS
				const visibleCells = calculateVisibleCells({
					tokenX: x,
					tokenY: y,
					visionRadius: token.visionRadius || 10,
					walls: store.wallsList,
					gridWidth: store.grid.width,
					gridHeight: store.grid.height
				})

				// Send to server for persistence
				if (props.connection && visibleCells.length > 0) {
					await props.connection.invoke('RevealArea', props.sessionId, props.userId, visibleCells)
				}
			} catch (err) {
				console.error('Error auto-revealing fog:', err)
			}
		}

		function isTokenVisibleToPlayer(token) {
			// Master sees all tokens
			if (props.isMaster) {
				return true
			}

			// DM-only tokens are hidden from players
			if (token.isDmOnly) {
				return false
			}

			// If fog is disabled, all non-DM tokens are visible
			if (!store.fogOfWar.enabled) {
				return true
			}

			// Check if token position is in revealed fog cells
			const isRevealed = store.fogOfWar.revealedCells.some(
				cell => cell.x === token.x && cell.y === token.y
			)

			return isRevealed
		}

		function canDragToken(token) {
			// Master can drag all tokens
			if (props.isMaster) return true

			// Players can only drag their own tokens
			return token.ownerId && token.ownerId === props.userId
		}

		async function sendTokenMove(tokenId, x, y) {
			const now = Date.now()
			const lastTime = lastMoveTime.get(tokenId) || 0

			if (now - lastTime < MOVE_THROTTLE_MS) {
				// Store pending move
				pendingMoves.set(tokenId, { x, y })

				// Schedule sending pending move
				setTimeout(() => {
					const pending = pendingMoves.get(tokenId)
					if (pending) {
						pendingMoves.delete(tokenId)
						sendTokenMove(tokenId, pending.x, pending.y)
					}
				}, MOVE_THROTTLE_MS - (now - lastTime))

				return
			}

			// Send move immediately
			lastMoveTime.set(tokenId, now)
			pendingMoves.delete(tokenId)

			try {
				if (props.connection) {
					await props.connection.invoke('MoveToken', props.sessionId, props.userId, tokenId, x, y)
				}
			} catch (err) {
				console.error('Error moving token:', err)
				throw err
			}
		}

		function snapToGrid(pixelX, pixelY) {
			const cellSize = store.grid.cellSizePixels
			const gridX = Math.round((pixelX - cellSize / 2) / cellSize)
			const gridY = Math.round((pixelY - cellSize / 2) / cellSize)

			// Clamp to grid bounds
			const clampedX = Math.max(0, Math.min(store.grid.width - 1, gridX))
			const clampedY = Math.max(0, Math.min(store.grid.height - 1, gridY))

			return { x: clampedX, y: clampedY }
		}

		function setupZoomAndPan() {
			if (!stage) return

			const scaleBy = 1.1
			let isPanning = false
			let lastPos = { x: 0, y: 0 }

			// Zoom with mouse wheel
			stage.on('wheel', (e) => {
				e.evt.preventDefault()

				const oldScale = stage.scaleX()
				const pointer = stage.getPointerPosition()

				const mousePointTo = {
					x: (pointer.x - stage.x()) / oldScale,
					y: (pointer.y - stage.y()) / oldScale
				}

				const direction = e.evt.deltaY > 0 ? -1 : 1
				const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

				// Limit zoom range
				const clampedScale = Math.max(0.2, Math.min(3, newScale))

				stage.scale({ x: clampedScale, y: clampedScale })

				const newPos = {
					x: pointer.x - mousePointTo.x * clampedScale,
					y: pointer.y - mousePointTo.y * clampedScale
				}

				stage.position(newPos)
			})

			// Pan with Ctrl+Drag or middle mouse button
			stage.on('mousedown', (e) => {
				if (e.evt.ctrlKey || e.evt.button === 1) {
					isPanning = true
					lastPos = stage.getPointerPosition()
					stage.container().style.cursor = 'grabbing'
				}
			})

			stage.on('mousemove', () => {
				if (!isPanning) return

				const pos = stage.getPointerPosition()
				const dx = pos.x - lastPos.x
				const dy = pos.y - lastPos.y

				stage.x(stage.x() + dx)
				stage.y(stage.y() + dy)

				lastPos = pos
			})

			stage.on('mouseup', () => {
				isPanning = false
				stage.container().style.cursor = 'default'
			})

			// Prevent context menu on right click
			stage.on('contextmenu', (e) => {
				e.evt.preventDefault()
			})
		}

		function centerViewport() {
			if (!stage) return

			const containerWidth = stage.width()
			const containerHeight = stage.height()

			const canvasW = canvasWidth.value
			const canvasH = canvasHeight.value

			// Calculate scale to fit
			const scaleX = containerWidth / canvasW
			const scaleY = containerHeight / canvasH
			const scale = Math.min(scaleX, scaleY, 1) * 0.9 // 90% to add some padding

			stage.scale({ x: scale, y: scale })

			// Center position
			const x = (containerWidth - canvasW * scale) / 2
			const y = (containerHeight - canvasH * scale) / 2

			stage.position({ x, y })
			stage.batchDraw()
		}

		// Watch for store changes
		watch(() => store.tokensList, () => {
			drawTokens()
		}, { deep: true })

		watch(() => store.wallsList, () => {
			drawWalls()
		}, { deep: true })

		watch(() => store.selectedTokenId, () => {
			highlightSelectedToken()
		})

		watch(() => store.fogOfWar, () => {
			// Clear cache before redrawing
			if (fogLayer) {
				fogLayer.clearCache()
			}
			drawFogOfWar()
		}, { deep: true })

		watch(() => props.currentTool, (newTool) => {
			// Cancel wall drawing when switching tools
			if (newTool !== 'wall') {
				cancelWallDrawing()
			}

			// Update cursor based on tool
			if (stage) {
				if (newTool === 'wall') {
					stage.container().style.cursor = 'crosshair'
				} else if (newTool === 'fog') {
					stage.container().style.cursor = 'cell'
				} else {
					stage.container().style.cursor = 'default'
				}
			}
		})

		onMounted(() => {
			initializeKonva()

			// Handle window resize
			window.addEventListener('resize', () => {
				if (stage && containerRef.value) {
					stage.width(containerRef.value.clientWidth)
					stage.height(containerRef.value.clientHeight)
					centerViewport()
				}
			})
		})

		onUnmounted(() => {
			if (stage) {
				stage.destroy()
			}
		})

		return {
			containerRef
		}
	}
}
