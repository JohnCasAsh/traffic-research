# Traffic Management System - First Plan Notes

Date: March 11, 2026
Project: Development of a Traffic Management System for Energy and Cost Efficient Route Optimization Using Integrated API Services

## 1. Project Direction
The team will build this in phases. The first target is a website prototype that recommends routes using energy and cost efficiency, not only fastest or shortest route.

## 2. Phase 1 Main Goal (MVP)
Deliver a working web prototype that can:
- Accept origin and destination input from users.
- Fetch 2 to 3 route options from map and traffic APIs.
- Estimate travel time, distance, fuel or energy use, and travel cost.
- Recommend the most efficient route using a scoring formula.
- Compare recommended route with standard fastest and shortest options.

## 3. Scope for Phase 1
In scope:
- Website interface for route input and result display.
- API integration for map, traffic, and location data.
- Route analysis engine with scoring and recommendation logic.
- Basic logging of test results for research evaluation.

Out of scope for now:
- OBD-II live hardware integration.
- Direct EV manufacturer API integration.
- Full mobile app release.
- Traffic light or city infrastructure control.

## 4. Three-Level Integration Roadmap
Level 1 (Implement now):
- Phone and API-based estimation.
- Inputs: GPS/location, distance, speed profile, traffic, and vehicle profile.
- Output: estimated fuel or energy consumption and route cost.

Level 2 (Future enhancement):
- OBD-II Bluetooth integration for fuel vehicles.
- Inputs: RPM, engine load, fuel rate or MAF, speed.
- Output: more accurate real fuel consumption.

Level 3 (Future enhancement):
- EV or vehicle API integration.
- Inputs: battery SoC, kWh use, charging status.
- Output: real EV energy consumption and cost.

## 5. Initial System Modules
- User Interface: route input, route cards, recommendation display.
- API Integration Layer: requests to map, traffic, and geolocation services.
- Route Analysis Engine: computes metrics and route score.
- Recommendation Module: selects best route by weighted score.
- Data Logger: stores route comparisons for study evaluation.

## 6. Draft Route Scoring Model
Use a weighted score where lower score is better:

RouteScore =
(0.35 x normalized_travel_time) +
(0.20 x normalized_distance) +
(0.25 x normalized_energy_or_fuel_cost) +
(0.20 x normalized_traffic_delay)

Note: weights can be adjusted after pilot testing.

## 7. First 2-Week Team Plan
Week 1:
- Finalize requirements and success metrics.
- Choose API providers and create API keys.
- Create wireframe for website input and result page.
- Define vehicle profile assumptions for fuel estimation.

Week 2:
- Build basic frontend input form and map display.
- Build backend endpoint to fetch route alternatives.
- Implement first scoring logic and recommendation output.
- Run sample route tests and record initial results.

## 8. Required Outputs for Phase 1 Completion
- Working website prototype (Level 1).
- Documented formula and recommendation logic.
- Test table comparing recommended, fastest, and shortest routes.
- Initial findings for thesis methodology and evaluation chapter.

## 9. Immediate Action Items (Start Now)
1. Assign team roles: frontend, backend/API, data analysis, documentation.
2. Decide initial API stack (Google Maps or Mapbox plus traffic source).
3. List at least 10 test origin-destination pairs for evaluation.
4. Build the project folder structure and setup repository.
5. Begin UI wireframe and backend API test script.
