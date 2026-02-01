import ROT from 'rot-js'

/**
 * Composable for Line-of-Sight calculations using ROT.js
 */
export function useLineOfSight() {
	/**
	 * Calculate visible cells from a token position using FOV algorithm
	 * @param {Object} params - Parameters
	 * @param {number} params.tokenX - Token grid X coordinate
	 * @param {number} params.tokenY - Token grid Y coordinate
	 * @param {number} params.visionRadius - Vision radius in grid cells (default: 10)
	 * @param {Array} params.walls - Array of wall objects with {x1, y1, x2, y2, blocksLight}
	 * @param {number} params.gridWidth - Grid width in cells
	 * @param {number} params.gridHeight - Grid height in cells
	 * @returns {Array} Array of {x, y} grid cells that are visible
	 */
	function calculateVisibleCells({
		tokenX,
		tokenY,
		visionRadius = 10,
		walls = [],
		gridWidth,
		gridHeight
	}) {
		const visibleCells = []

		// Build wall blocking map for efficient lookup
		const blockingMap = buildWallBlockingMap(walls, gridWidth, gridHeight)

		// Light passes callback for ROT.js
		const lightPasses = (x, y) => {
			// Out of bounds
			if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
				return false
			}

			// Check if cell is blocked by walls
			return !blockingMap.has(`${x},${y}`)
		}

		// Create FOV calculator (Precise Shadowcasting)
		const fov = new ROT.FOV.PreciseShadowcasting(lightPasses)

		// Compute FOV from token position
		fov.compute(tokenX, tokenY, visionRadius, (x, y, r, visibility) => {
			// r = distance from origin (0 at center, increases outward)
			// visibility = 0..1 (1 = fully visible, 0 = not visible)

			// Only include visible cells within grid bounds
			if (visibility > 0 && x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
				visibleCells.push({ x, y })
			}
		})

		return visibleCells
	}

	/**
	 * Build a map of cells blocked by walls
	 * A cell is blocked if it has a wall on any of its edges that blocks light
	 *
	 * Wall format: {x1, y1, x2, y2, blocksLight}
	 * - (x1,y1) and (x2,y2) are grid intersection points
	 * - A wall blocks the cells adjacent to it
	 */
	function buildWallBlockingMap(walls, gridWidth, gridHeight) {
		const blockedCells = new Set()

		walls.forEach(wall => {
			if (!wall.blocksLight) return

			// Wall coordinates (intersection points)
			const x1 = wall.x1
			const y1 = wall.y1
			const x2 = wall.x2
			const y2 = wall.y2

			// Determine wall orientation
			if (x1 === x2) {
				// Vertical wall between columns (x1-1) and (x1)
				const minY = Math.min(y1, y2)
				const maxY = Math.max(y1, y2)

				for (let y = minY; y < maxY; y++) {
					// Block cells on both sides of the wall
					if (x1 - 1 >= 0) blockedCells.add(`${x1 - 1},${y}`)
					if (x1 < gridWidth) blockedCells.add(`${x1},${y}`)
				}
			} else if (y1 === y2) {
				// Horizontal wall between rows (y1-1) and (y1)
				const minX = Math.min(x1, x2)
				const maxX = Math.max(x1, x2)

				for (let x = minX; x < maxX; x++) {
					// Block cells on both sides of the wall
					if (y1 - 1 >= 0) blockedCells.add(`${x},${y1 - 1}`)
					if (y1 < gridHeight) blockedCells.add(`${x},${y1}`)
				}
			}
		})

		return blockedCells
	}

	/**
	 * Calculate cells visible from multiple token positions (union of all FOVs)
	 * Useful for calculating total party vision
	 */
	function calculateCombinedVisibleCells(tokens, walls, gridWidth, gridHeight) {
		const allVisibleCells = new Set()

		tokens.forEach(token => {
			const visibleCells = calculateVisibleCells({
				tokenX: token.x,
				tokenY: token.y,
				visionRadius: token.visionRadius || 10,
				walls,
				gridWidth,
				gridHeight
			})

			visibleCells.forEach(cell => {
				allVisibleCells.add(`${cell.x},${cell.y}`)
			})
		})

		// Convert back to array of {x, y}
		return Array.from(allVisibleCells).map(key => {
			const [x, y] = key.split(',').map(Number)
			return { x, y }
		})
	}

	/**
	 * Check if a specific cell is visible from a token position
	 */
	function isCellVisible(cellX, cellY, tokenX, tokenY, walls, gridWidth, gridHeight, visionRadius = 10) {
		const visibleCells = calculateVisibleCells({
			tokenX,
			tokenY,
			visionRadius,
			walls,
			gridWidth,
			gridHeight
		})

		return visibleCells.some(cell => cell.x === cellX && cell.y === cellY)
	}

	return {
		calculateVisibleCells,
		calculateCombinedVisibleCells,
		isCellVisible
	}
}
