using LiteDB;

namespace DndSessionManager.Web.Models;

/// <summary>
/// Battle map state for D&D session
/// </summary>
public class BattleMap
{
	[BsonId]
	public Guid Id { get; set; } = Guid.NewGuid();

	public Guid SessionId { get; set; }

	/// <summary>
	/// Version for optimistic concurrency control
	/// </summary>
	public int Version { get; set; } = 0;

	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	public DateTime? UpdatedAt { get; set; }

	// Grid configuration
	public GridConfiguration Grid { get; set; } = new();

	// Tokens (normalized by ID)
	public List<BattleToken> Tokens { get; set; } = new();

	// Walls (edge-based format)
	public List<Wall> Walls { get; set; } = new();

	// Fog of War
	public FogOfWarState FogOfWar { get; set; } = new();

	// Background
	public BackgroundConfiguration Background { get; set; } = new();
}

public class GridConfiguration
{
	public int Width { get; set; } = 30; // cells
	public int Height { get; set; } = 20; // cells
	public int CellSizePixels { get; set; } = 50;
	public bool ShowGrid { get; set; } = true;
	public string GridColor { get; set; } = "#cccccc";
}

public class BattleToken
{
	public Guid Id { get; set; } = Guid.NewGuid();

	/// <summary>
	/// Reference to Character.Id (nullable for NPC tokens)
	/// </summary>
	public Guid? CharacterId { get; set; }

	public string Name { get; set; } = string.Empty;

	// Position (grid coordinates)
	public int X { get; set; }
	public int Y { get; set; }

	// Visual properties
	public int Size { get; set; } = 1; // 1x1, 2x2, etc (grid cells)
	public string Color { get; set; } = "#3498db";
	public string? ImageUrl { get; set; }
	public string? IconName { get; set; } // FontAwesome icon

	// Visibility
	public bool IsVisible { get; set; } = true;
	public bool IsDmOnly { get; set; } = false; // Visible only to DM

	// Ownership for drag control
	public Guid? OwnerId { get; set; } // User.Id, null = DM control only

	public int Order { get; set; } = 0; // Z-index
}

public class Wall
{
	public Guid Id { get; set; } = Guid.NewGuid();

	// Edge-based format: wall between cells
	public int X1 { get; set; }
	public int Y1 { get; set; }
	public int X2 { get; set; }
	public int Y2 { get; set; }

	public WallType Type { get; set; } = WallType.Solid;

	public bool BlocksLight { get; set; } = true;
	public bool BlocksMovement { get; set; } = true;
}

public enum WallType
{
	Solid,      // Opaque wall
	Window,     // Transparent, blocks movement
	Door        // Can be opened/closed
}

public class FogOfWarState
{
	public bool Enabled { get; set; } = false;

	/// <summary>
	/// Revealed cells (grid coordinates)
	/// </summary>
	public List<GridCell> RevealedCells { get; set; } = new();
}

public class GridCell
{
	public int X { get; set; }
	public int Y { get; set; }

	// For comparison in HashSet
	public override bool Equals(object? obj)
	{
		return obj is GridCell cell && X == cell.X && Y == cell.Y;
	}

	public override int GetHashCode()
	{
		return HashCode.Combine(X, Y);
	}
}

public class BackgroundConfiguration
{
	public string? ImageUrl { get; set; }
	public double Scale { get; set; } = 1.0;
	public int OffsetX { get; set; } = 0;
	public int OffsetY { get; set; } = 0;
}
