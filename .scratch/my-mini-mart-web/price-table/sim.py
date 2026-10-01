"""Coarse sanity check: how long does map 1 take to reach 100% Completion?

Not a game simulation. Each second it estimates an income rate from what is owned
(min of Customer demand, Producer supply, and Player/Staff carrying labour), and a
greedy player buys the cheapest available Pad or Upgrade level.

Run: python3 sim.py           timeline + total time
     python3 sim.py --table   the price table as markdown
Edit the NUMBERS section and re-run.
"""

import math

# ---------------------------------------------------------------- NUMBERS

START_MONEY = 50
STACK_BASE = 16  # prototype had 10
AREA_SCALE = {1: 0.45, 2: 0.4, 3: 0.7}  # extra cost multiplier per Area (Upgrades follow their station)
COST_SCALE = 1.0  # multiplies every Pad (except the starting three) and Upgrade cost
START_PADS = {"register", "tomato_shelf", "tomato_bed"}

# Sale Prices (fixed in "Design the economy and progression of the first map")
PRICE = {"tomato": 3, "egg": 5, "ketchup": 6, "wheat": 4, "milk": 7, "flour": 8, "bread": 20}

# Producers: kind, product, inputs, count/plants, seconds per output (Crop: regrow per plant)
PRODUCER = {
    "tomato_bed": dict(kind="crop", out="tomato", inputs=[], plants=4, secs=6.0),
    "chicken_coop": dict(kind="animal", out="egg", inputs=["tomato"], secs=4.0),
    "blender": dict(kind="machine", out="ketchup", inputs=["tomato"], secs=3.0),
    "wheat_field": dict(kind="crop", out="wheat", inputs=[], plants=4, secs=7.0),
    "cow_pen": dict(kind="animal", out="milk", inputs=["wheat"], secs=5.0),
    "mill": dict(kind="machine", out="flour", inputs=["wheat"], secs=4.0),
    "oven": dict(kind="machine", out="bread", inputs=["flour", "egg"], secs=6.0),
}
EXTRA_PLOTS = 4  # "more plots" Pads add this many plants
PRODUCER_SPEED_STEP = 0.8  # each Producer Speed level multiplies secs by this

# Pads in unlock order. Each: (id, cost, requirements). "|" groups open together.
PADS = [
    ("register", 10, []),
    ("tomato_shelf", 15, ["register"]),
    ("tomato_bed", 25, ["tomato_shelf"]),
    ("egg_shelf", 40, ["tomato_bed"]),
    ("chicken_coop", 60, ["egg_shelf"]),
    ("office", 75, ["chicken_coop"]),
    ("ketchup_shelf", 90, ["office"]),
    ("blender", 85, ["ketchup_shelf"]),
    ("cashier_1", 95, ["blender"]),
    ("chicken_2", 90, ["blender"]),
    ("tomato_plots", 80, ["blender"]),
    ("area_2", 400, ["cashier_1"]),
    ("stocker_1", 500, ["area_2"]),
    ("wheat_shelf", 150, ["stocker_1"]),
    ("wheat_field", 200, ["wheat_shelf"]),
    ("milk_fridge", 250, ["wheat_field"]),
    ("cow_pen", 300, ["milk_fridge"]),
    ("flour_shelf", 300, ["cow_pen"]),
    ("mill", 400, ["flour_shelf"]),
    ("wheat_plots", 350, ["mill"]),
    ("cow_2", 450, ["mill"]),
    ("area_3", 1500, ["mill"]),
    ("bread_shelf", 600, ["area_3"]),
    ("oven", 900, ["bread_shelf"]),
    ("register_2", 800, ["oven"]),
    ("cashier_2", 1000, ["register_2"]),
    ("stocker_2", 1200, ["oven"]),
    ("blender_2", 700, ["oven"]),
    ("mill_2", 1000, ["oven"]),
    ("oven_2", 1500, ["mill_2", "blender_2"]),
    ("exit", 3000, ["oven_2"]),
]

# Upgrades: id -> (requirement, first cost, values per level [base, L1, L2, ...])
COST_GROWTH = 1.8
UPGRADE = {
    "player_speed": ("office", 60, [5.5, 6.0, 6.5, 7.0, 7.5]),  # m/s
    "stack_cap": ("office", 80, [STACK_BASE + 4 * i for i in range(5)]),
    "cashier_speed": ("cashier_1", 150, [2.0, 1.6, 1.3, 1.0]),  # s per Customer
    "stocker_speed": ("stocker_1", 200, [4.0, 4.5, 5.0, 5.5, 6.0]),
    "stocker_carry": ("stocker_1", 200, [6, 8, 10, 12, 14]),
    "shelf_cap": ("office", 100, [8, 12, 16, 20]),
    "speed_tomato_bed": ("tomato_bed", 50, [0, 1, 2, 3]),
    "speed_chicken_coop": ("chicken_coop", 60, [0, 1, 2]),
    "speed_blender": ("blender", 70, [0, 1, 2]),
    "speed_wheat_field": ("wheat_field", 150, [0, 1, 2, 3]),
    "speed_cow_pen": ("cow_pen", 180, [0, 1, 2]),
    "speed_mill": ("mill", 200, [0, 1]),
    "speed_oven": ("oven", 300, [0, 1, 2]),
}

# Customers
ARRIVAL_SECS = 1.5  # fastest arrival; normally the Customer Cap limits it
CUSTOMER_BASE_SECS = 18.0  # walk in, browse, walk out
SECS_PER_ITEM_TAKEN = 0.6
UNITS_PER_PRODUCT = 2.5  # mean of 1..4
PLAYER_CHECKOUT_SECS = 1.5  # per Customer when the Player stands at the Register

# Labour
AVG_TRIP_METRES = 10.0  # one way, station <-> shelf
SECS_PER_ITEM_MOVED = 0.45  # pick-up + drop-off, averaged
CASH_OVERHEAD = 0.10  # share of Player time spent walking to Cash Piles / Pads / Office

# ---------------------------------------------------------------- MODEL

SHELF_OF = {"tomato": "tomato_shelf", "egg": "egg_shelf", "ketchup": "ketchup_shelf",
            "wheat": "wheat_shelf", "milk": "milk_fridge", "flour": "flour_shelf", "bread": "bread_shelf"}


def upgrade_value(levels: dict, uid: str) -> float:
    return UPGRADE[uid][2][levels[uid]]


def nice(x: float) -> int:
    step = 5 if x < 100 else 25 if x < 1000 else 50
    return max(step, round(x / step) * step)


def upgrade_cost(uid: str, level: int) -> int:
    req = UPGRADE[uid][0]
    return nice(UPGRADE[uid][1] * COST_GROWTH ** level * COST_SCALE * AREA_SCALE[area_of(req)])


def area_of(pid: str) -> int:
    ids = [p for p, _, _ in PADS]
    i = ids.index(pid)
    return 1 if i < ids.index("area_2") else 2 if i < ids.index("area_3") else 3


def pad_cost(pid: str, cost: int) -> int:
    return cost if pid in START_PADS else nice(cost * COST_SCALE * AREA_SCALE[area_of(pid)])


def producer_rate(pid: str, owned: set, levels: dict) -> float:
    """Outputs per minute, ignoring inputs."""
    p = PRODUCER[pid]
    secs = p["secs"] * PRODUCER_SPEED_STEP ** levels.get(f"speed_{pid}", 0)
    if p["kind"] == "crop":
        plots = {"tomato_bed": "tomato_plots", "wheat_field": "wheat_plots"}[pid]
        plants = p["plants"] + (EXTRA_PLOTS if plots in owned else 0)
        return plants * 60 / secs
    second = {"chicken_coop": "chicken_2", "cow_pen": "cow_2", "blender": "blender_2",
              "mill": "mill_2", "oven": "oven_2"}.get(pid)
    count = 2 if second in owned else 1
    return count * 60 / secs


def income_per_min(owned: set, levels: dict) -> tuple[float, dict]:
    for_sale = [prod for prod, shelf in SHELF_OF.items()
                if shelf in owned and any(p["out"] == prod and pid in owned for pid, p in PRODUCER.items())]
    if not for_sale or "register" not in owned:
        return 0.0, {}
    n = len(for_sale)
    cashiers = sum(c in owned for c in ("cashier_1", "cashier_2"))
    cap = math.floor((2 + n) * 1.3 ** cashiers)
    mean_products = (1 + min(4, n)) / 2
    units = mean_products * UNITS_PER_PRODUCT
    dwell = CUSTOMER_BASE_SECS + units * SECS_PER_ITEM_TAKEN
    customers = min(cap * 60 / dwell, 60 / ARRIVAL_SECS)
    registers = 1 + ("register_2" in owned)
    if cashiers:
        customers = min(customers, cashiers * 60 / upgrade_value(levels, "cashier_speed")
                        + (registers - cashiers) * 60 / PLAYER_CHECKOUT_SECS)
    demand = {prod: customers * units / n for prod in for_sale}

    # Supply: raw crops shared between direct sale and downstream producers (greedy by value)
    raw = {"tomato": 0.0, "wheat": 0.0}
    if "tomato_bed" in owned:
        raw["tomato"] = producer_rate("tomato_bed", owned, levels)
    if "wheat_field" in owned:
        raw["wheat"] = producer_rate("wheat_field", owned, levels)
    sold = {}
    moves = 0.0  # item-carries needed per minute
    made = {}
    for pid in ("chicken_coop", "blender", "cow_pen", "mill"):
        if pid not in owned:
            continue
        out, (inp,) = PRODUCER[pid]["out"], PRODUCER[pid]["inputs"]
        want = producer_rate(pid, owned, levels)
        if out in demand:
            want = min(want, demand[out] + (demand.get("bread", 0) if out in ("egg", "flour") else 0))
        got = min(want, raw[inp])
        raw[inp] -= got
        made[out] = got
        moves += got  # carry input to producer
    if "oven" in owned:
        b = min(producer_rate("oven", owned, levels), demand.get("bread", 0),
                made.get("flour", 0), made.get("egg", 0))
        made["flour"] -= b
        made["egg"] -= b
        made["bread"] = b
        moves += 2 * b
    for prod in for_sale:
        avail = raw.get(prod, 0) + made.get(prod, 0)
        sold[prod] = min(demand[prod], avail)
        moves += sold[prod]  # carry to shelf

    # Labour available (item-carries per minute)
    speed, stack = upgrade_value(levels, "player_speed"), upgrade_value(levels, "stack_cap")
    trip = 2 * AVG_TRIP_METRES / speed + stack * SECS_PER_ITEM_MOVED
    player_share = 1 - CASH_OVERHEAD
    if not cashiers:
        player_share -= customers * PLAYER_CHECKOUT_SECS / 60
    labour = max(0.0, player_share) * 60 * stack / trip
    stockers = sum(s in owned for s in ("stocker_1", "stocker_2"))
    if stockers:
        s_speed, s_carry = upgrade_value(levels, "stocker_speed"), upgrade_value(levels, "stocker_carry")
        labour += stockers * 60 * s_carry / (2 * AVG_TRIP_METRES / s_speed + s_carry * SECS_PER_ITEM_MOVED)
    scale = min(1.0, labour / moves) if moves else 1.0
    income = sum(sold[p] * PRICE[p] for p in sold) * scale
    return income, dict(for_sale=n, cap=cap, customers=round(customers, 1), labour_bound=scale < 1)


def run() -> None:
    owned: set = set()
    levels = {u: 0 for u in UPGRADE}
    money, t = float(START_MONEY), 0
    total_steps = len(PADS) + sum(len(v[2]) - 1 for v in UPGRADE.values())
    log = []
    while len(log) < total_steps and t < 4 * 3600:
        options = [(pad_cost(pid, cost), pid, None) for pid, cost, req in PADS
                   if pid not in owned and all(r in owned for r in req)]
        options += [(upgrade_cost(u, levels[u]), u, levels[u] + 1) for u, (req, _, vals) in UPGRADE.items()
                    if req in owned and "office" in owned and levels[u] < len(vals) - 1]
        cost, item, lvl = min(options)
        if money >= cost:
            money -= cost
            if lvl is None:
                owned.add(item)
            else:
                levels[item] = lvl
            rate, info = income_per_min(owned, levels)
            log.append((t, item if lvl is None else f"{item} L{lvl}", cost, round(rate), info))
            continue
        rate, _ = income_per_min(owned, levels)
        money += rate / 60
        t += 1
    for t_, item, cost, rate, info in log:
        print(f"{t_ // 60:3d}:{t_ % 60:02d}  {item:22s} ${cost:>5}  → ${rate:>5}/min  {info}")
    print(f"\n100% Completion after {t / 60:.1f} min ({len(log)}/{total_steps} purchases)")
    pads = sum(pad_cost(p, c) for p, c, _ in PADS)
    ups = sum(upgrade_cost(u, l) for u, v in UPGRADE.items() for l in range(len(v[2]) - 1))
    print(f"Total spend: Pads ${pads}, Upgrades ${ups}, levels {total_steps - len(PADS)}")


def print_table() -> None:
    print(f"# Map 1 price table\n\nGenerated by `python3 sim.py --table`. Starting Money: ${START_MONEY}.\n")
    print("## Pads (unlock order)\n\n| Area | Pad | Cost | Requires |\n|---|---|---|---|")
    for pid, cost, req in PADS:
        print(f"| {area_of(pid)} | {pid} | ${pad_cost(pid, cost)} | {', '.join(req) or '—'} |")
    print("\n## Upgrades\n\n| Upgrade | Appears after | Level costs | Values (base → max) |\n|---|---|---|---|")
    for uid, (req, _, vals) in UPGRADE.items():
        costs = " / ".join(f"${upgrade_cost(uid, lvl)}" for lvl in range(len(vals) - 1))
        shown = f"work time ×{PRODUCER_SPEED_STEP} per level" if uid.startswith("speed_") else " → ".join(map(str, vals))
        print(f"| {uid} | {req} | {costs} | {shown} |")
    print("\n## Producers\n\n| Producer | Recipe | Base timing |\n|---|---|---|")
    for pid, p in PRODUCER.items():
        recipe = f"{' + '.join(p['inputs']) or '—'} → {p['out']}"
        timing = f"{p['plants']} plants, each regrows in {p['secs']} s" if p["kind"] == "crop" else f"{p['secs']} s per output"
        print(f"| {pid} | {recipe} | {timing} |")


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["--table"]:
        print_table()
        sys.exit()
    if len(sys.argv) > 1:
        COST_SCALE = float(sys.argv[1])
    if len(sys.argv) > 2:
        STACK_BASE = int(sys.argv[2])
        UPGRADE["stack_cap"] = ("office", 80, [STACK_BASE + 4 * i for i in range(5)])
    run()
