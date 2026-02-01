using System.Collections.Concurrent;
using DndSessionManager.Web.Data;
using DndSessionManager.Web.Models;

namespace DndSessionManager.Web.Services;

public class BattleMapService
{
	private static readonly ConcurrentDictionary<Guid, BattleMap> _activeMaps = new();
	private readonly ISessionRepository _repository;

	public BattleMapService(ISessionRepository repository)
	{
		_repository = repository;
	}

	// === CRUD Operations ===

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

	// === Token Operations ===

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

	// === Wall Operations ===

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

	// === Fog of War ===

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

	// === Permission Checks ===

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
}
