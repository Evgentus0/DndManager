using System.Collections.Concurrent;
using DndSessionManager.Web.Data;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Hubs;

namespace DndSessionManager.Web.Services;

public class BattleMapService
{
	private static readonly ConcurrentDictionary<Guid, BattleMap> _activeMaps = new();
	private readonly ISessionRepository _repository;

	public BattleMapService(ISessionRepository repository)
	{
		_repository = repository;
	}

	#region === CRUD Operations ===

	public BattleMap CreateBattleMap(Guid sessionId)
	{
		var map = new BattleMap
		{
			SessionId = sessionId,
			Version = 0
		};

		_activeMaps.TryAdd(map.Id, map);
		_repository.SaveBattleMap(map);

		return map;
	}

	public BattleMap? GetBattleMap(Guid mapId)
	{
		_activeMaps.TryGetValue(mapId, out var map);
		return map;
	}

	public BattleMap? GetBattleMapBySession(Guid sessionId)
	{
		return _activeMaps.Values.FirstOrDefault(m => m.SessionId == sessionId)
			?? _repository.GetBattleMapBySession(sessionId);
	}

	public void LoadBattleMapIntoMemory(Guid sessionId)
	{
		var map = _repository.GetBattleMapBySession(sessionId);
		if (map != null && !_activeMaps.ContainsKey(map.Id))
		{
			_activeMaps.TryAdd(map.Id, map);
		}
	}

	public void SaveAndDeactivateBattleMap(Guid mapId)
	{
		if (_activeMaps.TryRemove(mapId, out var map))
		{
			_repository.SaveBattleMap(map);
		}
	}
	#endregion

	#region === Token Operations ===

	public bool AddToken(Guid mapId, BattleToken token)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.Tokens.Add(token);
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool UpdateTokenPosition(Guid mapId, Guid tokenId, int newX, int newY)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenId);
		if (token == null)
			return false;

		token.X = newX;
		token.Y = newY;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		// Don't save every move to DB (throttled updates from SignalR Hub)
		return true;
	}

	public bool UpdateToken(BattleMap map, BattleToken token, BattleTokenUpdateDto updates)
	{
		// Apply updates (only non-null values)
		if (updates.Name != null)
			token.Name = updates.Name;
		if (updates.Color != null)
			token.Color = updates.Color;
		if (updates.ImageUrl != null)
			token.ImageUrl = updates.ImageUrl;
		if (updates.Size.HasValue)
			token.Size = updates.Size.Value;
		if (updates.IsVisible.HasValue)
			token.IsVisible = updates.IsVisible.Value;
		if (updates.IsDmOnly.HasValue)
			token.IsDmOnly = updates.IsDmOnly.Value;
		if (updates.Initiative.HasValue)
			token.Initiative = updates.Initiative.Value;

		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool RemoveToken(Guid mapId, Guid tokenId)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenId);
		if (token == null)
			return false;

		map.Tokens.Remove(token);
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool UpdateTokenInitiative(Guid mapId, Guid tokenId, int? initiative)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		var token = map.Tokens.FirstOrDefault(t => t.Id == tokenId);
		if (token == null)
			return false;

		token.Initiative = initiative;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool SwapTokenInitiatives(Guid mapId, Guid tokenId1, Guid tokenId2)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		var token1 = map.Tokens.FirstOrDefault(t => t.Id == tokenId1);
		var token2 = map.Tokens.FirstOrDefault(t => t.Id == tokenId2);

		if (token1 == null || token2 == null)
			return false;

		// Swap initiative values
		var tempInitiative = token1.Initiative;
		token1.Initiative = token2.Initiative;
		token2.Initiative = tempInitiative;

		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}
	#endregion

	#region === Wall Operations ===

	public bool AddWall(Guid mapId, Wall wall)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.Walls.Add(wall);
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool RemoveWall(Guid mapId, Guid wallId)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		var wall = map.Walls.FirstOrDefault(w => w.Id == wallId);
		if (wall == null)
			return false;

		map.Walls.Remove(wall);
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}
	#endregion

	#region === Fog of War ===

	public bool RevealCells(Guid mapId, List<GridCell> cells)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		foreach (var cell in cells)
		{
			if (!map.FogOfWar.RevealedCells.Any(c => c.X == cell.X && c.Y == cell.Y))
			{
				map.FogOfWar.RevealedCells.Add(cell);
			}
		}

		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool ShroudCells(Guid mapId, List<GridCell> cells)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.FogOfWar.RevealedCells.RemoveAll(c =>
			cells.Any(cell => cell.X == c.X && cell.Y == c.Y));

		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool SetFogEnabled(Guid sessionId, bool enabled)
	{
		var map = GetBattleMapBySession(sessionId);
		if (map == null) return false;

		map.FogOfWar.Enabled = enabled;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		SaveBattleMap(map);
		return true;
	}

	private void SaveBattleMap(BattleMap map)
	{
		_repository.SaveBattleMap(map);
	}
	#endregion

	#region === Background Operations ===

	public bool UpdateBackgroundImage(Guid mapId, string? imageUrl, double scale = 1.0, int offsetX = 0, int offsetY = 0)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.Background.ImageUrl = imageUrl;
		map.Background.Scale = scale;
		map.Background.OffsetX = offsetX;
		map.Background.OffsetY = offsetY;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool RemoveBackgroundImage(Guid mapId)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.Background.ImageUrl = null;
		map.Background.Scale = 1.0;
		map.Background.OffsetX = 0;
		map.Background.OffsetY = 0;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}
	#endregion

	#region === Grid Operations ===

	public (bool Success, List<(Guid TokenId, int OldX, int OldY, int NewX, int NewY)> MovedTokens) UpdateGridDimensions(Guid mapId, int newWidth, int newHeight)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return (false, new List<(Guid, int, int, int, int)>());

		// Validate dimensions
		if (newWidth < 5 || newWidth > 100 || newHeight < 5 || newHeight > 100)
			return (false, new List<(Guid, int, int, int, int)>());

		var movedTokens = new List<(Guid TokenId, int OldX, int OldY, int NewX, int NewY)>();

		// Clamp token positions to new bounds
		foreach (var token in map.Tokens)
		{
			var oldX = token.X;
			var oldY = token.Y;
			var newX = Math.Min(token.X, newWidth - 1);
			var newY = Math.Min(token.Y, newHeight - 1);

			if (oldX != newX || oldY != newY)
			{
				token.X = newX;
				token.Y = newY;
				movedTokens.Add((token.Id, oldX, oldY, newX, newY));
			}
		}

		// Remove fog cells outside new bounds
		map.FogOfWar.RevealedCells.RemoveAll(c => c.X >= newWidth || c.Y >= newHeight);

		// Update grid dimensions
		map.Grid.Width = newWidth;
		map.Grid.Height = newHeight;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return (true, movedTokens);
	}

	public bool UpdateGridColor(Guid mapId, string newColor)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		// Validate hex color format
		if (string.IsNullOrWhiteSpace(newColor) || !newColor.StartsWith("#"))
			return false;

		map.Grid.GridColor = newColor;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool UpdateGridWidth(Guid mapId, int newGridWidth)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		if (newGridWidth < 1 || newGridWidth > 10)
		{
			return false;
		}

		map.Grid.GridWidth = newGridWidth;
		map.Version++;
		map.UpdatedAt = DateTime.UtcNow;

		_repository.SaveBattleMap(map);
		return true;
	}
	#endregion

	#region === Permission Checks ===

	public bool CanUserMoveToken(BattleToken token, Guid userId, bool isMaster)
	{
		// DM can move any token
		if (isMaster)
			return true;

		// Player can only move their own token
		return token.OwnerId.HasValue && token.OwnerId.Value == userId;
	}

	public bool CanUserEditMap(bool isMaster)
	{
		// Only DM can edit the map (walls, background, fog)
		return isMaster;
	}

	public bool CanUserEditToken(BattleToken token, Guid userId, bool isMaster)
	{
		if (isMaster)
			return true;

		return token.OwnerId.HasValue && token.OwnerId.Value == userId;
	}
	#endregion
}
