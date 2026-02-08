import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'
import Konva from 'konva'

export default {
	name: 'BattleMapCanvas',
	template: `
		<div>
			<div ref="containerRef" class="battle-map-canvas" style="width: 100%; background: #1a1a1a; border-radius: 5px; overflow: hidden;"></div>
		</div>
	`,
	props: {
		sessionId: { type: String, required: true },
		userId: { type: String, required: true },
		isMaster: { type: Boolean, required: true },
		connection: { type: Object, required: false },
		currentTool: { type: String, default: 'select' }
	},
	emits: ['token-moved'],
	setup(props, { emit }) {
		const store = useBattleMapStore()
		const containerRef = ref(null)

		let stage = null
		let backgroundLayer = null
		let gridLayer = null
		let tokensLayer = null
		let wheelHandler = null
		let mousedownHandler = null

		const tokenShapes = new Map() // tokenId -> Konva.Group

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
			tokensLayer = new Konva.Layer()

			stage.add(backgroundLayer)
			stage.add(gridLayer)
			stage.add(tokensLayer)

			// Prevent default wheel behavior on container
			wheelHandler = (e) => {
				e.preventDefault()
				e.stopPropagation()
			}
			container.addEventListener('wheel', wheelHandler, { passive: false })

			// Prevent middle mouse button default behavior (auto-scroll)
			mousedownHandler = (e) => {
				if (e.button === 1) {
					e.preventDefault()
				}
			}
			container.addEventListener('mousedown', mousedownHandler)

			// Draw initial content
			drawBackground()
			drawGrid()
			drawTokens()

			// Setup zoom and pan
			setupZoomAndPan()
			setupTouchGestures()

			// Center viewport
			centerViewport()
		}

		function drawBackground() {
			if (!backgroundLayer) return

			backgroundLayer.destroyChildren()

			if (store.background.imageUrl) {
				// Load and render background image
				const imageObj = new Image()
				imageObj.onload = () => {
					const konvaImage = new Konva.Image({
						image: imageObj,
						x: store.background.offsetX || 0,
						y: store.background.offsetY || 0,
						width: canvasWidth.value * (store.background.scale || 1.0),
						height: canvasHeight.value * (store.background.scale || 1.0),
					})
					backgroundLayer.add(konvaImage)
					backgroundLayer.batchDraw()
				}
				imageObj.onerror = () => {
					// Fallback to solid color on image load error
					const background = new Konva.Rect({
						x: 0,
						y: 0,
						width: canvasWidth.value,
						height: canvasHeight.value,
						fill: '#2c3e50'
					})
					backgroundLayer.add(background)
					backgroundLayer.batchDraw()
				}
				imageObj.src = store.background.imageUrl
			} else {
				// Solid color background (default)
				const background = new Konva.Rect({
					x: 0,
					y: 0,
					width: canvasWidth.value,
					height: canvasHeight.value,
					fill: '#2c3e50'
				})
				backgroundLayer.add(background)
				backgroundLayer.batchDraw()
			}
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
					stroke: store.grid.gridColor,
					strokeWidth: store.grid.gridWidth,
					opacity: 0.5
				})
				gridLayer.add(line)
			}

			// Horizontal lines
			for (let i = 0; i <= store.grid.height; i++) {
				const line = new Konva.Line({
					points: [0, i * cellSize, width, i * cellSize],
					stroke: store.grid.gridColor,
					strokeWidth: store.grid.gridWidth,
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

			// Check if token has an image
			if (token.imageUrl) {
				// Load image asynchronously
				const imageObj = new Image()

				imageObj.onload = () => {
					const diameter = radius * 2

					// Create Konva.Image with circular clipping
					const imageNode = new Konva.Image({
						image: imageObj,
						x: -radius,
						y: -radius,
						width: diameter,
						height: diameter,
						cornerRadius: radius, // Makes it circular
						stroke: '#ecf0f1',
						strokeWidth: 3
					})

					group.add(imageNode)
					addTokenText(group, token, radius)
					tokensLayer.batchDraw()
				}

				imageObj.onerror = () => {
					// Fallback to colored circle on image load error
					createFallbackCircle(group, token, radius)
				}

				imageObj.src = token.imageUrl
			} else {
				// No image - use standard colored circle
				createFallbackCircle(group, token, radius)
			}

			// Setup drag events
			if (canDragToken(token)) {
				let originalPos = { x: token.x, y: token.y }

				group.on('dragstart', () => {
					originalPos = { x: token.x, y: token.y }
					group.moveToTop()

					// Highlight border on drag (works for both Circle and Image)
					const mainShape = group.findOne((node) =>
						node.getClassName() === 'Circle' || node.getClassName() === 'Image'
					)
					if (mainShape) {
						mainShape.stroke('#3498db')
						mainShape.strokeWidth(4)
					}

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
					const mainShape = group.findOne((node) =>
						node.getClassName() === 'Circle' || node.getClassName() === 'Image'
					)
					if (mainShape) {
						mainShape.stroke('#ecf0f1')
						mainShape.strokeWidth(3)
					}

					// Snap to grid
					group.x(snappedPos.x * cellSize + cellSize / 2)
					group.y(snappedPos.y * cellSize + cellSize / 2)

					// Optimistic update
					store.moveToken(token.id, snappedPos.x, snappedPos.y)

					// Send to server (throttled)
					try {
						await sendTokenMove(token.id, snappedPos.x, snappedPos.y)
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

			// Check if image status changed (had image -> no image, or no image -> has image)
			const existingImage = shape.findOne('Image')
			const hasImageNow = !!token.imageUrl
			const hadImageBefore = !!existingImage

			// If image status changed, need to recreate the shape
			if (hasImageNow !== hadImageBefore) {
				shape.destroy()
				tokenShapes.delete(token.id)
				createTokenShape(token)
				return
			}

			// Update position
			shape.x(token.x * cellSize + cellSize / 2)
			shape.y(token.y * cellSize + cellSize / 2)

			// Update circle (if no image)
			const circle = shape.findOne('Circle')
			if (circle) {
				circle.radius(radius)
				circle.fill(token.color)
			}

			// Update image (if has image and URL changed)
			if (existingImage && token.imageUrl) {
				const diameter = radius * 2
				existingImage.width(diameter)
				existingImage.height(diameter)
				existingImage.x(-radius)
				existingImage.y(-radius)
				existingImage.cornerRadius(radius)

				// Reload image if URL changed
				const currentSrc = existingImage.image()?.src
				if (currentSrc !== token.imageUrl) {
					const imageObj = new Image()
					imageObj.onload = () => {
						existingImage.image(imageObj)
						tokensLayer.batchDraw()
					}
					imageObj.src = token.imageUrl
				}
			}

			// Update text
			const texts = shape.find('Text')
			texts.forEach(text => {
				text.text(token.name)
				text.x(-radius)
				text.width(radius * 2)
			})

			tokensLayer.batchDraw()
		}

		function createFallbackCircle(group, token, radius) {
			const circle = new Konva.Circle({
				x: 0,
				y: 0,
				radius: radius,
				fill: token.color,
				stroke: '#ecf0f1',
				strokeWidth: 3
			})
			group.add(circle)
			addTokenText(group, token, radius)
			tokensLayer.batchDraw()
		}

		function addTokenText(group, token, radius) {
			// Text stroke (black outline)
			const textStroke = new Konva.Text({
				x: -radius,
				y: radius + 5,
				width: radius * 2,
				text: token.name,
				fontSize: 14,
				fontFamily: 'Arial',
				fill: '#000000',
				stroke: '#000000',
				strokeWidth: 4,
				align: 'center'
			})

			// White text on top
			const text = new Konva.Text({
				x: -radius,
				y: radius + 5,
				width: radius * 2,
				text: token.name,
				fontSize: 14,
				fontFamily: 'Arial',
				fill: '#ffffff',
				align: 'center'
			})

			group.add(textStroke)
			group.add(text)
		}

		function highlightSelectedToken() {
			// Reset all tokens
			for (const shape of tokenShapes.values()) {
				const mainShape = shape.findOne((node) =>
					node.getClassName() === 'Circle' || node.getClassName() === 'Image'
				)
				if (mainShape) {
					mainShape.stroke('#ecf0f1')
					mainShape.strokeWidth(3)
				}
			}

			// Highlight selected
			if (store.selectedTokenId) {
				const shape = tokenShapes.get(store.selectedTokenId)
				if (shape) {
					const mainShape = shape.findOne((node) =>
						node.getClassName() === 'Circle' || node.getClassName() === 'Image'
					)
					if (mainShape) {
						mainShape.stroke('#f39c12')
						mainShape.strokeWidth(5)
					}
				}
			}

			tokensLayer.batchDraw()
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

			// All non-DM tokens are visible to players (no fog checks)
			return true
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

	/**
	 * Apply zoom to stage centered on pointer position
	 * @param {number} newScale - Desired scale value
	 * @param {{x: number, y: number}} pointerPosition - Point to center zoom on
	 */
	function applyZoom(newScale, pointerPosition) {
		if (!stage) return

		const oldScale = stage.scaleX()
		const clampedScale = Math.max(0.2, Math.min(3, newScale))

		const mousePointTo = {
			x: (pointerPosition.x - stage.x()) / oldScale,
			y: (pointerPosition.y - stage.y()) / oldScale
		}

		stage.scale({ x: clampedScale, y: clampedScale })

		const newPos = {
			x: pointerPosition.x - mousePointTo.x * clampedScale,
			y: pointerPosition.y - mousePointTo.y * clampedScale
		}

		stage.position(newPos)
		stage.batchDraw()
	}

	/**
	 * Apply panning to stage
	 * @param {number} dx - Delta x movement
	 * @param {number} dy - Delta y movement
	 */
	function applyPan(dx, dy) {
		if (!stage) return

		stage.x(stage.x() + dx)
		stage.y(stage.y() + dy)
		stage.batchDraw()
	}
	function setupZoomAndPan() {
		if (!stage) return

		const scaleBy = 1.1
		let isPanning = false
		let lastPos = { x: 0, y: 0 }

		// Zoom with mouse wheel
		stage.on('wheel', (e) => {
			e.evt.preventDefault()
			e.evt.stopPropagation()

			const oldScale = stage.scaleX()
			const pointer = stage.getPointerPosition()
			const direction = e.evt.deltaY > 0 ? -1 : 1
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy

			applyZoom(newScale, pointer)
		})

		// Pan with Ctrl+Drag or middle mouse button
		stage.on('mousedown', (e) => {
			if (e.evt.ctrlKey || e.evt.button === 1) {
				e.evt.preventDefault() // Prevent default auto-scroll
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

			applyPan(dx, dy)
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

	function setupTouchGestures() {
		if (!stage) return

		// Helper functions for touch calculations
		function getDistance(p1, p2) {
			return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
		}

		function getCenter(p1, p2) {
			return {
				x: (p1.x + p2.x) / 2,
				y: (p1.y + p2.y) / 2
			}
		}

		// Touch state variables
		let lastCenter = null
		let lastDist = 0
		let dragStopped = false
		let isTouchPanning = false
		let lastTouchPos = null

		// Touch move handler (handles both pinch-zoom and single-finger pan)
		stage.on('touchmove', (e) => {
			e.evt.preventDefault() // Prevent browser scrolling and zoom

			const touches = e.evt.touches
			const touch1 = touches[0]
			const touch2 = touches[1]

			// TWO-FINGER PINCH ZOOM
			if (touch1 && touch2) {
				// Stop any active panning
				if (isTouchPanning) {
					isTouchPanning = false
					lastTouchPos = null
				}

				// Stop any token dragging
				if (stage.isDragging()) {
					dragStopped = true
					stage.stopDrag()
				}

				const rect = stage.container().getBoundingClientRect()
				const p1 = {
					x: touch1.clientX - rect.left,
					y: touch1.clientY - rect.top
				}
				const p2 = {
					x: touch2.clientX - rect.left,
					y: touch2.clientY - rect.top
				}

				// Initialize on first two-finger touch
				if (!lastCenter) {
					lastCenter = getCenter(p1, p2)
					lastDist = getDistance(p1, p2)
					return
				}

				const newCenter = getCenter(p1, p2)
				const newDist = getDistance(p1, p2)

				// Calculate new scale based on distance change
				const oldScale = stage.scaleX()
				const scaleChange = newDist / lastDist
				const newScale = oldScale * scaleChange

				// Apply zoom centered on pinch point
				applyZoom(newScale, newCenter)

				// Apply pan based on center movement
				const dx = newCenter.x - lastCenter.x
				const dy = newCenter.y - lastCenter.y
				applyPan(dx, dy)

				lastDist = newDist
				lastCenter = newCenter
			}
			// SINGLE-FINGER PAN (only if not dragging a token)
			else if (touch1 && !touch2 && !stage.isDragging()) {
				const rect = stage.container().getBoundingClientRect()
				const currentPos = {
					x: touch1.clientX - rect.left,
					y: touch1.clientY - rect.top
				}

				if (!isTouchPanning) {
					// Check if touch started on a draggable token
					const touchPos = stage.getPointerPosition()
					const shape = stage.getIntersection(touchPos)

					// If touching a draggable token, let Konva handle it
					if (shape && shape.getParent()?.draggable()) {
						return
					}

					// Otherwise, start panning
					isTouchPanning = true
					lastTouchPos = currentPos
					stage.container().style.cursor = 'grabbing'
					return
				}

				// Continue panning
				if (lastTouchPos) {
					const dx = currentPos.x - lastTouchPos.x
					const dy = currentPos.y - lastTouchPos.y

					applyPan(dx, dy)
					lastTouchPos = currentPos
				}
			}
		})

		// Touch end handler (reset state)
		stage.on('touchend', () => {
			lastDist = 0
			lastCenter = null
			isTouchPanning = false
			lastTouchPos = null
			dragStopped = false
			stage.container().style.cursor = 'default'
		})

		// Touch start handler (prepare for gestures)
		stage.on('touchstart', (e) => {
			// Reset state when new touch begins
			if (e.evt.touches.length === 1) {
				lastTouchPos = null
				isTouchPanning = false
			}
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

		watch(() => store.selectedTokenId, () => {
			highlightSelectedToken()
		})

		watch(() => props.currentTool, () => {
			// Update cursor based on tool
			if (stage) {
				stage.container().style.cursor = 'default'
			}
		})

		watch(() => store.background, () => {
			drawBackground()
		}, { deep: true })

		watch(() => [store.grid.width, store.grid.height], () => {
			drawBackground()
			drawGrid()
			drawTokens()
			centerViewport()
		}, { deep: true })

		watch(() => [store.grid.gridColor, store.grid.gridWidth], () => {
			drawGrid()
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
			// Remove event listeners
			if (containerRef.value && wheelHandler) {
				containerRef.value.removeEventListener('wheel', wheelHandler)
			}
			if (containerRef.value && mousedownHandler) {
				containerRef.value.removeEventListener('mousedown', mousedownHandler)
			}

			if (stage) {
				stage.destroy()
			}
		})

		return {
			containerRef
		}
	}
}
