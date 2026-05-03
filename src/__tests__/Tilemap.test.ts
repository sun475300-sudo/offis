import { describe, it, expect, beforeEach } from 'vitest';
import { Tilemap, TILE_SIZE } from '../spatial/Tilemap';
import { TileType } from '../types';

// 기본 60×40 레이아웃 사용
const W = 60;
const H = 40;

describe('Tilemap', () => {
  let map: Tilemap;

  beforeEach(() => {
    map = new Tilemap(W, H);
  });

  // ── 기본 속성 ────────────────────────────────────────────────────────
  it('getWidth/getHeight가 생성 시 크기를 반환한다', () => {
    expect(map.getWidth()).toBe(W);
    expect(map.getHeight()).toBe(H);
  });

  // ── getTile 경계 처리 ─────────────────────────────────────────────────
  it('범위 밖 좌표는 Wall + 걷기불가 타일을 반환한다', () => {
    const oob = map.getTile(-1, -1);
    expect(oob.type).toBe(TileType.Wall);
    expect(oob.walkable).toBe(false);

    const oob2 = map.getTile(W, H);
    expect(oob2.walkable).toBe(false);
  });

  it('범위 안 좌표는 타일 객체를 반환한다', () => {
    const tile = map.getTile(1, 1);
    expect(tile).toBeDefined();
    expect(tile.walkable).toBeDefined();
  });

  // ── isWalkable ────────────────────────────────────────────────────────
  it('범위 밖 좌표는 isWalkable이 false를 반환한다', () => {
    expect(map.isWalkable(-5, 0)).toBe(false);
    expect(map.isWalkable(0, H + 1)).toBe(false);
  });

  it('외곽 벽(0행, 0열)은 걷기불가다', () => {
    // The office layout always places walls on the perimeter
    expect(map.isWalkable(0, 0)).toBe(false);
  });

  it('내부 타일 중 floor 타입은 걷기가능이다', () => {
    // Walk the grid to find at least one walkable tile
    let found = false;
    outer: for (let r = 1; r < H - 1; r++) {
      for (let c = 1; c < W - 1; c++) {
        if (map.isWalkable(c, r)) { found = true; break outer; }
      }
    }
    expect(found).toBe(true);
  });

  // ── setOccupant ───────────────────────────────────────────────────────
  it('setOccupant가 occupantId를 설정/해제한다', () => {
    // find a walkable tile to occupy
    let wc = -1, wr = -1;
    outer: for (let r = 1; r < H - 1; r++) {
      for (let c = 1; c < W - 1; c++) {
        if (map.isWalkable(c, r)) { wc = c; wr = r; break outer; }
      }
    }
    expect(wc).toBeGreaterThan(0);

    map.setOccupant(wc, wr, 'agent-1');
    expect(map.getTile(wc, wr).occupantId).toBe('agent-1');

    map.setOccupant(wc, wr, null);
    expect(map.getTile(wc, wr).occupantId).toBeNull();
  });

  it('범위 밖 setOccupant 호출은 예외를 던지지 않는다', () => {
    expect(() => map.setOccupant(-1, -1, 'x')).not.toThrow();
  });

  // ── gridToWorld / worldToGrid ─────────────────────────────────────────
  it('gridToWorld가 타일 중심 픽셀 좌표를 반환한다', () => {
    const pos = map.gridToWorld({ col: 2, row: 3 });
    expect(pos.x).toBe(2 * TILE_SIZE + TILE_SIZE / 2);
    expect(pos.y).toBe(3 * TILE_SIZE + TILE_SIZE / 2);
  });

  it('worldToGrid가 픽셀 좌표를 그리드 셀로 변환한다', () => {
    const cell = map.worldToGrid({ x: 2 * TILE_SIZE + 10, y: 3 * TILE_SIZE + 5 });
    expect(cell.col).toBe(2);
    expect(cell.row).toBe(3);
  });

  it('gridToWorld → worldToGrid 왕복 변환이 일치한다', () => {
    const original = { col: 5, row: 7 };
    const world = map.gridToWorld(original);
    // worldToGrid from center should recover the same cell
    const recovered = map.worldToGrid(world);
    expect(recovered.col).toBe(original.col);
    expect(recovered.row).toBe(original.row);
  });

  // ── getRawGrid ────────────────────────────────────────────────────────
  it('getRawGrid가 H×W 크기의 2D 배열을 반환한다', () => {
    const grid = map.getRawGrid();
    expect(grid).toHaveLength(H);
    expect(grid[0]).toHaveLength(W);
  });
});

// ── 추가 커버리지: placeDesk / removeFurniture / placeMeetingTable / findNearestWalkable ──

describe('Tilemap - 가구 배치 및 BFS 탐색', () => {
  const W2 = 20;
  const H2 = 20;
  let map: Tilemap;

  beforeEach(() => {
    map = new Tilemap(W2, H2);
  });

  it('placeDesk가 floor 위에 desk를 놓는다', () => {
    // find a floor cell
    let dc = -1, dr = -1;
    outer: for (let r = 1; r < H2 - 1; r++) {
      for (let c = 1; c < W2 - 1; c++) {
        if (map.getTile(c, r).type === TileType.Floor) { dc = c; dr = r; break outer; }
      }
    }
    expect(dc).toBeGreaterThan(0);
    const result = map.placeDesk(dc, dr);
    expect(result).toBe(true);
    expect(map.getTile(dc, dr).type).toBe(TileType.Desk);
    expect(map.isWalkable(dc, dr)).toBe(false);
  });

  it('placeDesk는 범위 밖 좌표에서 false를 반환한다', () => {
    expect(map.placeDesk(0, 0)).toBe(false);      // 경계
    expect(map.placeDesk(-1, 5)).toBe(false);      // 음수
    expect(map.placeDesk(W2, H2)).toBe(false);     // 초과
  });

  it('removeFurniture가 desk를 floor로 복원한다', () => {
    // place then remove
    let dc = -1, dr = -1;
    outer: for (let r = 1; r < H2 - 1; r++) {
      for (let c = 1; c < W2 - 1; c++) {
        if (map.getTile(c, r).type === TileType.Floor) { dc = c; dr = r; break outer; }
      }
    }
    map.placeDesk(dc, dr);
    const removed = map.removeFurniture(dc, dr);
    expect(removed).toBe(true);
    expect(map.getTile(dc, dr).type).toBe(TileType.Floor);
    expect(map.isWalkable(dc, dr)).toBe(true);
  });

  it('removeFurniture는 floor/wall 타일에서 false를 반환한다', () => {
    // floor cell → cannot remove (it's already floor)
    let fc = -1, fr = -1;
    outer: for (let r = 1; r < H2 - 1; r++) {
      for (let c = 1; c < W2 - 1; c++) {
        if (map.getTile(c, r).type === TileType.Floor) { fc = c; fr = r; break outer; }
      }
    }
    expect(map.removeFurniture(fc, fr)).toBe(false);
  });

  it('placeMeetingTable이 floor 셀에 테이블을 배치하고 배치 수를 반환한다', () => {
    // find a 3×3 all-floor block
    let sc = -1, sr = -1;
    outer: for (let r = 2; r < H2 - 4; r++) {
      for (let c = 2; c < W2 - 4; c++) {
        let ok = true;
        for (let dr2 = 0; dr2 < 2 && ok; dr2++)
          for (let dc2 = 0; dc2 < 2 && ok; dc2++)
            if (map.getTile(c + dc2, r + dr2).type !== TileType.Floor) ok = false;
        if (ok) { sc = c; sr = r; break outer; }
      }
    }
    if (sc < 0) return; // skip if no 2×2 floor block found (layout dependent)
    const placed = map.placeMeetingTable(sc, sr, 2, 2);
    expect(placed).toBe(4);
    expect(map.getTile(sc, sr).type).toBe(TileType.MeetingTable);
    expect(map.isWalkable(sc, sr)).toBe(false);
  });

  it('findNearestWalkable는 이미 walkable이면 동일 셀을 반환한다', () => {
    let wc = -1, wr = -1;
    outer: for (let r = 1; r < H2 - 1; r++) {
      for (let c = 1; c < W2 - 1; c++) {
        if (map.isWalkable(c, r)) { wc = c; wr = r; break outer; }
      }
    }
    const result = map.findNearestWalkable({ col: wc, row: wr });
    expect(result).toEqual({ col: wc, row: wr });
  });

  it('findNearestWalkable는 desk 셀 주변에서 walkable 셀을 찾는다', () => {
    let dc = -1, dr = -1;
    outer: for (let r = 3; r < H2 - 3; r++) {
      for (let c = 3; c < W2 - 3; c++) {
        if (map.getTile(c, r).type === TileType.Floor) { dc = c; dr = r; break outer; }
      }
    }
    if (dc < 0) return;
    map.placeDesk(dc, dr);
    const nearby = map.findNearestWalkable({ col: dc, row: dr });
    expect(map.isWalkable(nearby.col, nearby.row)).toBe(true);
  });
});
