# CLAUDE.md — Project Context for Claude Code

## Who Is This For
John Asley — BS Computer Science student at University of Saint Louis Tuguegarao.
This file gives Claude persistent context across all sessions on this project.

---

## Thesis

**Title:** Energy-Aware Multi-Modal Route Optimization for Urban Commuters in Tuguegarao City
**School:** University of Saint Louis Tuguegarao — BS Computer Science

### Core Claim
The fastest route is not always the cheapest, and the shortest route is not always the most efficient.
The system recommends the most cost-efficient and fuel-efficient route, not just shortest/fastest.

### Target Users
- Tricycle operators
- Delivery drivers
- Private car commuters
- Location: Tuguegarao City, Cagayan, Philippines

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native |
| Backend | Node.js |
| Database | PostgreSQL + PostGIS |
| Map Data | OpenStreetMap |
| Data Collection | navocs.com (GPS/speed logging tool) |

---

## Core Algorithm

**Modified A* Algorithm** with energy-aware edge cost function.

### Edge Cost Function
```
C(e) = w1 × T(e) + w2 × F(e) + w3 × D(e) + w4 × S(e)
```
- `T(e)` = travel time on edge e
- `F(e)` = fuel/energy consumption (via VSP)
- `D(e)` = traffic delay penalty (time-of-day)
- `S(e)` = speed stability score
- `w1–w4` = user-adjustable weights

### VSP Formula (ICE Vehicles)
```
VSP = v × (1.1a + 9.81 × grade + 0.132) + 0.000302 × v³
```
- `v` = instantaneous speed (m/s)
- `a` = instantaneous acceleration (m/s²)
- `grade` = road gradient

### EV Energy Model
```
E(e) = (m × g × Cr × d + 0.5 × ρ × Cd × A × v² × d + m × a × d) / η
```

### Efficiency Scoring Model
```
EfficiencyScore = w1·T + w2·C_fuel + w3·D_traffic + w4·S_stability
```

---

## Vehicle Profiles
| Type | Powertrain | Model |
|---|---|---|
| Tricycle | ICE | VSP-based fuel model |
| Motorcycle | ICE | VSP-based fuel model |
| Private Car | ICE | VSP-based fuel model |
| Hybrid Car | HEV | Dual-mode cost function |
| E-Trike | BEV | Energy model + SoC constraint |
| E-Motorcycle | BEV | Energy model + SoC constraint |

---

## Research Gaps This Fills
1. No eco-routing system for Philippine provincial cities
2. No routing optimized for tricycle fuel profiles (ICE or EV)
3. No cross-powertrain cost comparison tool
4. No VSP model calibrated for Filipino vehicles
5. No routing system aligned with RA 11697 (PH EV Law — target: 2.45M EVs by 2028)

---

## Chapter 1 Status (as of March 2026)
| Section | Status |
|---|---|
| Abstract | ✅ Done |
| Introduction | ✅ Done |
| Hypothesis | ✅ Done |
| Significance of the Study | ✅ Done |
| Literature Review | ✅ Done (needs proper citations) |
| Background of the Study | ❌ Not yet written |
| Statement of the Problem | ❌ Not yet written |
| Methods | ❌ Wrong — accidentally pasted from a different qualitative study (accounting graduates). Needs full rewrite. |

### Methods Section — What It Should Contain
- **Research Design:** Agile System Development Life Cycle (SDLC)
- **System Architecture:** React Native + PostGIS + Modified A* + VSP module
- **Data Sources:** OpenStreetMap, GPS/phone sensors, optional OBD-II
- **Algorithm Design:** Modified A* with VSP edge cost function
- **Testing & Validation:** Simulation on Tuguegarao routes, paired t-test comparison vs Dijkstra/standard A*

---

## Key References
| Source | Topic |
|---|---|
| ACM Computing Surveys, 2024 | Eco-routing algorithm taxonomy |
| Applied Sciences (MDPI), 2019 | VSP + Digital Map API fuel prediction |
| Energy (Elsevier), 2024 | Dual-objective eco-routing by powertrain |
| Transportation Research Part E, 2024 | EV fleet eco-routing validation |
| Sustainable Cities and Society, 2021 | Multi-Objective A* for EVs |
| World Electric Vehicle Journal, 2025 | Eco-driving efficiency across vehicle types |
| Transportation Research Part D, 2007 | Tricycle emissions in Metro Manila |
| Sustainable Energy (Elsevier), 2025 | Philippine EV policy and RA 11697 |

---

## Codebase Notes
- Backend is Node.js in `backend/src/`
- `liveTracking.js` handles real-time GPS tracking
- `SpeedMeterPrototypePage.tsx` is a throwaway prototype for collecting GPS speed data for thesis validation
- The speed meter uses GPS Doppler + Kalman filter; data exported as CSV for thesis analysis
