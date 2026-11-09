"""Vehicle and climate presets.

Climate values are approximate monthly mean air temperatures (deg C),
rounded from public climate normals. Replace or extend with data from
Environment Canada / NOAA if you need more precision.
"""

VEHICLES = {
    "compact_car": {
        "label": "Compact EV (e.g. 60 kWh hatchback)",
        "pack_kwh": 60.0,
        "kwh_per_km": 0.16,
        "avg_speed_kmh": 40.0,
        "level2_kw": 7.2,
        "dcfc_kw": 75.0,
    },
    "midsize_car": {
        "label": "Mid-size EV sedan/SUV (e.g. 80 kWh)",
        "pack_kwh": 80.0,
        "kwh_per_km": 0.18,
        "avg_speed_kmh": 45.0,
        "level2_kw": 11.0,
        "dcfc_kw": 150.0,
    },
    "pickup": {
        "label": "Electric pickup (e.g. 130 kWh)",
        "pack_kwh": 130.0,
        "kwh_per_km": 0.28,
        "avg_speed_kmh": 50.0,
        "level2_kw": 11.5,
        "dcfc_kw": 150.0,
    },
    "city_bus": {
        "label": "Electric city bus (e.g. 450 kWh)",
        "pack_kwh": 450.0,
        "kwh_per_km": 1.2,
        "avg_speed_kmh": 18.0,
        "level2_kw": 60.0,   # depot charger
        "dcfc_kw": 300.0,    # pantograph / opportunity charger
    },
}

CLIMATES = {
    "red_deer": {"label": "Red Deer, AB", "monthly_c": [-10.6, -8.6, -3.6, 4.0, 9.9, 14.0, 16.4, 15.3, 10.4, 4.2, -3.9, -9.3]},
    "calgary": {"label": "Calgary, AB", "monthly_c": [-6.8, -5.4, -1.1, 4.8, 9.6, 13.8, 16.5, 15.8, 11.0, 5.2, -1.5, -6.4]},
    "edmonton": {"label": "Edmonton, AB", "monthly_c": [-10.4, -8.4, -3.3, 4.8, 11.1, 15.1, 17.5, 16.3, 11.0, 4.6, -3.7, -9.0]},
    "vancouver": {"label": "Vancouver, BC", "monthly_c": [4.1, 4.9, 6.9, 9.4, 12.8, 15.7, 18.0, 18.1, 15.1, 10.6, 6.4, 3.8]},
    "toronto": {"label": "Toronto, ON", "monthly_c": [-5.5, -4.5, 0.1, 7.1, 13.1, 18.6, 21.5, 20.6, 16.2, 9.5, 3.4, -2.2]},
    "phoenix": {"label": "Phoenix, AZ", "monthly_c": [13.6, 15.4, 18.6, 22.7, 28.0, 33.0, 35.4, 34.8, 31.6, 25.2, 18.1, 13.0]},
}

DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]