using System.Collections.Concurrent;
using DndSessionManager.Web.Models;
using DndSessionManager.Web.Hubs;
using DndSessionManager.Web.Persistence;

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
		var existing = GetActiveMap(sessionId);
		if (existing != null)
			return existing;

		return CreateNewMap(sessionId, "Map 1", setAsActive: true);
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

	#region === Map Management ===

	public List<BattleMap> GetBattleMaps(Guid sessionId)
	{
		var activeMaps = _activeMaps.Values
			.Where(m => m.SessionId == sessionId)
			.OrderBy(m => m.DisplayOrder)
			.ToList();

		if (activeMaps.Any())
			return activeMaps;

		return _repository.GetBattleMaps(sessionId).ToList();
	}

	public BattleMap? GetActiveMap(Guid sessionId)
	{
		return _activeMaps.Values.FirstOrDefault(m => m.SessionId == sessionId && m.IsActive)
			?? _repository.GetActiveBattleMap(sessionId);
	}

	public BattleMap CreateNewMap(Guid sessionId, string name, bool setAsActive = false)
	{
		var existingMaps = GetBattleMaps(sessionId);
		var maxOrder = existingMaps.Any() ? existingMaps.Max(m => m.DisplayOrder) : -1;

		var map = new BattleMap
		{
			SessionId = sessionId,
			Name = name,
			IsActive = setAsActive,
			DisplayOrder = maxOrder + 1
		};

		if (setAsActive)
		{
			_repository.SetActiveMap(sessionId, map.Id);
		}

		_activeMaps.TryAdd(map.Id, map);
		_repository.SaveBattleMap(map);

		return map;
	}

	public bool RenameMap(Guid mapId, string newName)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		map.Name = newName;
		map.UpdatedAt = DateTime.UtcNow;
		map.Version++;

		_repository.SaveBattleMap(map);
		return true;
	}

	public bool DeleteMap(Guid mapId)
	{
		if (!_activeMaps.TryGetValue(mapId, out var map))
			return false;

		// Cannot delete if it's the only map
		var sessionMaps = GetBattleMaps(map.SessionId);
		if (sessionMaps.Count == 1)
			return false;

		// If deleting active map, activate another map first
		if (map.IsActive)
		{
			var nextMap = sessionMaps.First(m => m.Id != mapId);
			SwitchActiveMap(map.SessionId, nextMap.Id);
		}

		_activeMaps.TryRemove(mapId, out _);
		_repository.DeleteBattleMap(mapId);
		_repository.DeleteTokenPositionsForMap(mapId);

		return true;
	}

	public (bool Success, List<BattleToken> MigratedTokens) SwitchActiveMap(Guid sessionId, Guid newMapId)
	{
		var oldActiveMap = GetActiveMap(sessionId);
		var newActiveMap = _activeMaps.TryGetValue(newMapId, out var map) ? map : _repository.GetBattleMap(newMapId);

		if (newActiveMap == null || newActiveMap.SessionId != sessionId)
			return (false, new List<BattleToken>());

		if (oldActiveMap?.Id == newMapId)
			return (true, new List<BattleToken>()); // Already active

		// Load new map into memory if needed
		if (!_activeMaps.ContainsKey(newMapId))
			_activeMaps.TryAdd(newMapId, newActiveMap);

		var migratedTokens = new List<BattleToken>();

		if (oldActiveMap != null)
		{
			// Step 1: Save positions of player tokens on old map
			var playerTokens = oldActiveMap.Tokens.Where(t => t.OwnerId.HasValue).ToList();
			foreach (var token in playerTokens)
			{
				_repository.SaveTokenPosition(new TokenPositionHistory
				{
					SessionId = sessionId,
					UserId = token.OwnerId.Value,
					MapId = oldActiveMap.Id,
					X = token.X,
					Y = token.Y
				});
			}

			// Step 2: Remove player tokens from old map (creature tokens stay)
			oldActiveMap.Tokens.RemoveAll(t => t.OwnerId.HasValue);
			oldActiveMap.IsActive = false;
			_repository.SaveBattleMap(oldActiveMap);

			// Step 3: Migrate player tokens to new map
			foreach (var oldToken in playerTokens)
			{
				var existingToken = newActiveMap.Tokens.FirstOrDefault(t =>
					t.OwnerId.HasValue && t.OwnerId.Value == oldToken.OwnerId.Value);

				if (existingToken == null)
				{
					// Restore previous position or use default (1, 1)
					var savedPosition = _repository.GetTokenPositionForMap(sessionId, oldToken.OwnerId.Value, newMapId);

					var newToken = new BattleToken
					{
						CharacterId = oldToken.CharacterId,
						Name = oldToken.Name,
						OwnerId = oldToken.OwnerId,
						X = savedPosition?.X ?? 1,
						Y = savedPosition?.Y ?? 1,
						Size = oldToken.Size,
						Color = oldToken.Color,
						ImageUrl = oldToken.ImageUrl,
						IsVisible = true,
						IsDmOnly = false,
						Initiative = null // Reset initiative on map switch
					};

					newActiveMap.Tokens.Add(newToken);
					migratedTokens.Add(newToken);
				}
			}
		}

		// Step 4: Activate new map
		newActiveMap.IsActive = true;
		newActiveMap.UpdatedAt = DateTime.UtcNow;
		newActiveMap.Version++;
		_repository.SaveBattleMap(newActiveMap);
		_repository.SetActiveMap(sessionId, newMapId);

		return (true, migratedTokens);
	}

	#endregion
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
