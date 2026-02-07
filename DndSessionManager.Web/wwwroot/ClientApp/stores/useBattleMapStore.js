import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBattleMapStore = defineStore('battleMap', () => {
	// === State ===

	const mapId = ref(null)
	const sessionId = ref(null)
	const version = ref(0)

	// Grid
	const grid = ref({
		width: 30,
		height: 20,
		cellSizePixels: 50,
		showGrid: true,
		gridColor: '#cccccc'
	})

	// Tokens (normalized by ID)
	const tokens = ref({})

	// Walls
	const walls = ref({})

	// Fog of War
	const fogOfWar = ref({
		enabled: false,
		revealedCells: []
	})

	// Background
	const background = ref({
		imageUrl: null,
		scale: 1.0,
		offsetX: 0,
		offsetY: 0
	})

	// UI State
	const selectedTokenId = ref(null)
	const selectedTool = ref('select') // 'select', 'wall', 'fog', 'measure'
	const viewportTransform = ref({
		x: 0,
		y: 0,
		scale: 1.0
	})

	// === Getters ===

	const tokensList = computed(() => Object.values(tokens.value))
	const wallsList = computed(() => Object.values(walls.value))
	const selectedToken = computed(() =>
		selectedTokenId.value ? tokens.value[selectedTokenId.value] : null
	)

	const canvasWidth = computed(() => grid.value.width * grid.value.cellSizePixels)
	const canvasHeight = computed(() => grid.value.height * grid.value.cellSizePixels)

	// === Actions ===

	function initializeMap(initialData) {
		mapId.value = initialData.id
		sessionId.value = initialData.sessionId
		version.value = initialData.version

		grid.value = { ...initialData.grid }

		// Normalize tokens
		tokens.value = {}
		initialData.tokens?.forEach(token => {
			tokens.value[token.id] = token
		})

		// Normalize walls
		walls.value = {}
		initialData.walls?.forEach(wall => {
			walls.value[wall.id] = wall
		})

		fogOfWar.value = { ...initialData.fogOfWar }
		background.value = { ...initialData.background }
	}

	function addToken(token) {
		tokens.value[token.id] = token
		version.value++
	}

	function updateToken(tokenId, updates) {
		if (tokens.value[tokenId]) {
			tokens.value[tokenId] = { ...tokens.value[tokenId], ...updates }
			version.value++
		}
	}

	function removeToken(tokenId) {
		delete tokens.value[tokenId]
		if (selectedTokenId.value === tokenId) {
			selectedTokenId.value = null
		}
		version.value++
	}

	function moveToken(tokenId, x, y) {
		if (tokens.value[tokenId]) {
			tokens.value[tokenId].x = x
			tokens.value[tokenId].y = y
			version.value++
		}
	}

	function addWall(wall) {
		walls.value[wall.id] = wall
		version.value++
	}

	function removeWall(wallId) {
		delete walls.value[wallId]
		version.value++
	}

	function revealCells(cells) {
		cells.forEach(cell => {
			const exists = fogOfWar.value.revealedCells.some(
				c => c.x === cell.x && c.y === cell.y
			)
			if (!exists) {
				fogOfWar.value.revealedCells.push(cell)
			}
		})
		version.value++
	}

	function shroudCells(cells) {
		fogOfWar.value.revealedCells = fogOfWar.value.revealedCells.filter(
			revealed => !cells.some(cell => cell.x === revealed.x && cell.y === revealed.y)
		)
		version.value++
	}

	function setSelectedToken(tokenId) {
		selectedTokenId.value = tokenId
	}

	function setSelectedTool(tool) {
		selectedTool.value = tool
		if (tool !== 'select') {
			selectedTokenId.value = null
		}
	}

	function updateViewport(transform) {
		viewportTransform.value = { ...transform }
	}

	function snapToGrid(pixelX, pixelY) {
		const cellSize = grid.value.cellSizePixels
		const gridX = Math.round(pixelX / cellSize)
		const gridY = Math.round(pixelY / cellSize)
		return { x: gridX, y: gridY }
	}

	function gridToPixel(gridX, gridY) {
		const cellSize = grid.value.cellSizePixels
		return {
			x: gridX * cellSize,
			y: gridY * cellSize
		}
	}

	function updateBackground(imageUrl, scale = 1.0, offsetX = 0, offsetY = 0) {
		background.value = {
			imageUrl,
			scale,
			offsetX,
			offsetY
		}
		version.value++
	}

	function updateGridSize(newWidth, newHeight) {
		grid.value.width = newWidth
		grid.value.height = newHeight
		version.value++
	}

	return {
		// State
		mapId,
		sessionId,
		version,
		grid,
		tokens,
		walls,
		fogOfWar,
		background,
		selectedTokenId,
		selectedTool,
		viewportTransform,

		// Getters
		tokensList,
		wallsList,
		selectedToken,
		canvasWidth,
		canvasHeight,

		// Actions
		initializeMap,
		addToken,
		updateToken,
		removeToken,
		moveToken,
		addWall,
		removeWall,
		revealCells,
		shroudCells,
		setSelectedToken,
		setSelectedTool,
		updateViewport,
		snapToGrid,
		gridToPixel,
		updateBackground,
		updateGridSize
	}
})
