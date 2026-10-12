# FullTank Web App (`fronted-full-tank`)

Angular web application of **FullTank**, the IoT fuel replenishment platform built by the **PrimeFuel** startup.

- Web app: https://primefuel-frontend-three.vercel.app
- API: https://fulltank-backend.onrender.com/api
- Report: https://github.com/16518-IoT-PrimeFuel/Report-IoT

## What is FullTank?

Fuel distributors with a tanker fleet cannot see the level of their buyers' tanks. Orders arrive by phone or email, drivers and tankers are assigned by hand without checking capacity, and there is no central record of each delivery.

FullTank is contracted by the distributor and covers the whole cycle:

1. A **Tank Monitoring Device** (ESP32 + JSN-SR04T ultrasonic sensor) installed on the buyer's tank reports its level through `POST /api/telemetry/readings`.
2. When the level drops below the tank threshold (20 % by default), a **replenishment request** is generated automatically. The buyer can also create one manually.
3. The distributor **accepts or rejects** the request. Accepting creates the fuel order.
4. The distributor **assigns a driver and a tanker** with enough capacity and no overlapping reservation.
5. The **delivery** goes through `ASSIGNED → STARTED → ARRIVED → DELIVERING → COMPLETED`.
6. The buyer **registers the payment** and the distributor confirms it.

## Roles

| Role | What they do in the web app |
|---|---|
| Distributor (`ROLE_PROVIDER`) | Dashboard, request inbox, orders, deliveries, clients and tanks, fleet (tankers and drivers), fuel products, payments, analytics. |
| Buyer (`ROLE_BUYER`) | Own tanks and sites, replenishment requests, orders, payment history, notifications, analytics. |
| Platform admin (`ROLE_ADMIN`) | Users, API metrics, payments, transport evidence. |
| Driver | Mobile app only; not part of this repository. |

## What the web app should have

- Public pages: home, about, sign in, buyer and distributor registration, password recovery, invitation acceptance.
- Role-based navigation and route guards; every user sees only their own company's data.
- Buyer: tanks with level, threshold and linked IoT device; manual request; order status and history; payment registration.
- Distributor: buyer lookup by RUC and registration; tank and device association; accept or reject requests (rejection needs a reason); assign delivery with recommendation; delivery timeline; payment confirmation and refund.
- Fleet and inventory CRUD: tankers, drivers, fuel products and stock.
- In-app notifications that stay visible until marked as read.
- Dashboards and analytics per role, with empty and error states.
- Spanish and English interface.

## Product backlog (user stories)

Taken from chapter 3 of the report. Technical stories (`TS-*`, backend endpoints) are not listed here. `S1` = Sprint 1, `S1*` = partially carried over to Sprint 2.

| # | ID | User story | Epic | SP | Sprint |
|---|---|---|---|---|---|
| 01 | US-50 | Generate automatic request from IoT threshold | EP02 | 5 | S1 |
| 02 | US-49 | Assign resources to a dispatch | EP08 | 5 | S1* |
| 03 | US-22 | Validate availability and capacity | EP08 | 5 | S1 |
| 05 | US-51 | Associate tank and IoT device | EP16 | 3 | S1* |
| 12 | US-41 | Register distributor company | EP04 | 3 | S1 |
| 16 | US-11 | Accept request | EP03 | 3 | — |
| 17 | US-44 | Manage fleet vehicles | EP08 | 3 | S1 |
| 18 | US-45 | Manage drivers | EP08 | 3 | S1 |
| 19 | US-47 | View distributor main dashboard | EP05 | 3 | S1 |
| 22 | US-55 | Generate delivery record | EP16 | 5 | — |
| 24 | US-06 | Check order status | EP02 | 2 | S1 |
| 25 | US-07 | Confirm order reception | EP02 | 2 | — |
| 26 | US-10 | View pending requests | EP03 | 2 | — |
| 27 | US-42 | Reject request | EP03 | 2 | — |
| 28 | US-15 | Sign in | EP04 | 2 | S1 |
| 29 | US-05 | Register contingency order | EP02 | 5 | S1 |
| 30 | US-08 | Register payment information | EP02 | 3 | S1 |
| 31 | US-46 | Manage fuel inventory | EP15 | 3 | S1 |
| 32 | US-29 | Receive approval notification | EP12 | 2 | S1 |
| 33 | US-30 | Order dispatched notification | EP12 | 2 | S1* |
| 37 | US-12 | Mark order as dispatched | EP03 | 2 | S1 |
| 38 | US-13 | Close order | EP03 | 2 | S1 |
| 41 | US-14 | Generate sales report | EP03 | 3 | — |
| 42 | US-34 | View sales chart (distributor) | EP14 | 3 | S1 |
| 43 | US-40 | Register buyer company | EP04 | 3 | S1 |
| 46 | US-54 | Receive operation alerts | EP16 | 3 | — |
| 47 | US-09 | View order history | EP02 | 2 | S1 |
| 48 | US-43 | View order detail | EP02 | 2 | S1 |
| 49 | US-16 | Recover password | EP04 | 2 | S1 |
| 51 | US-18 | View order summary (buyer) | EP05 | 3 | — |
| 52 | US-33 | View consumption chart (buyer) | EP14 | 3 | — |
| 53 | US-48 | View sales distribution by sector | EP14 | 2 | — |
| 54 | US-35 | Download PDF report | EP14 | 3 | — |
| 56 | US-17 | Sign out | EP04 | 1 | S1 |
| 58 | US-27 | Search order by code | EP11 | 2 | — |
| 59 | US-28 | Filter orders by status | EP11 | 2 | — |
| 60 | US-31 | View company list | EP13 | 2 | S1 |
| 61 | US-32 | View company details | EP13 | 2 | S1 |
| 62 | US-38 | View Plans and Pricing section | EP01 | 3 | S1 |
| 63 | US-24 | Edit profile data | EP09 | 2 | — |
| 67 | US-39 | Change language | EP01 | 3 | S1 |
| 68 | US-23 | View user profile | EP09 | 1 | — |
| 70 | US-04 | Send contact message | EP01 | 3 | S1 |
| 71 | US-01 | View Home section | EP01 | 2 | S1 |
| 72 | US-02 | View About Us section | EP01 | 1 | S1 |
| 73 | US-03 | View How it works? section | EP01 | 2 | S1 |
| 74 | US-36 | View Benefits section | EP01 | 1 | S1 |
| 75 | US-37 | View What Our Clients Say section | EP01 | 2 | S1 |
| 76 | US-25 | View frequently asked questions | EP10 | 2 | S1 |
| 77 | US-26 | Access quick contact information | EP10 | 1 | S1 |

Epics: EP01 Landing page · EP02 IoT activation and automatic requests · EP03 Request and order management · EP04 Authentication and registration · EP05 Dashboard · EP08 Resource assignment and dispatch · EP09 User profile · EP10 Support and contact · EP11 Order search and filtering · EP12 Notifications · EP13 Buyers and tanks · EP14 Reports and analytics · EP15 Inventory · EP16 Tank monitoring and delivery traceability.

## Tech stack

Angular 21, Angular Material, RxJS, `@ngx-translate/core`, Chart.js. Backend: Spring Boot (`../backend`).

## Project structure

Each bounded context under `src/app/` is split into `domain`, `application`, `infrastructure` and `presentation`.

```text
src/app/
  iam/            # Sign in, registration, password recovery, invitations, profile, guards
  dashboard/      # Buyer and distributor dashboards
  ordering/       # Replenishment requests, fuel orders, payments
  fulfillment/    # Deliveries, tankers, drivers
  equipment/      # Buyers, sites, tanks, IoT device links
  inventory/      # Fuel products and stock
  notification/   # In-app notifications
  analytics/      # Indicators and charts
  admin/          # Platform administration
  shared/         # Layout, base API classes, common views
src/environments/ # API base URL per environment
public/i18n/      # en.json, es.json
```

## Running the project

1. Start the Spring Boot backend from `../backend` on port `8080` (it needs `AUTHORIZATION_JWT_SECRET` and `DATABASE_PASSWORD`).
2. `npm install`
3. `npm start`, then open `http://localhost:4200/`.

Other commands: `ng build` (production build in `dist/`), `ng test` (unit tests).

The development API base is `http://localhost:8080/api`; production uses the URL in `src/environments/environment.ts`.
