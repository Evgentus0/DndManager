import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useBattleMapStore } from '../stores/useBattleMapStore.js'
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

			// Draw initial content
			drawBackground()
			drawGrid()
			drawTokens()

			// Setup zoom and pan
			setupZoomAndPan()

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
