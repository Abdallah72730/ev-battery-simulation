from typing import Optional

from pydantic import BaseModel, Field, model_validator

from .presets import CLIMATES, VEHICLES


class EstimateRequest(BaseModel):
    vehicle: str = Field("midsize_car", description="Key from /api/presets vehicles")
    climate: str = Field("red_deer", description="Key from /api/presets climates, or 'custom'")
    custom_monthly_c: Optional[list[float]] = Field(
        None, description="12 monthly mean temperatures (deg C), required when climate='custom'"
    )
    daily_km: float = Field(40, ge=1, le=600)
    fast_charge_share: float = Field(0.1, ge=0, le=1, description="Fraction of charges done on DC fast chargers")
    charge_target_soc: float = Field(0.8, ge=0.5, le=1.0)
    thermal_management: bool = True
    years: int = Field(10, ge=1, le=20)

    @model_validator(mode="after")
    def check_keys(self):
        if self.vehicle not in VEHICLES:
            raise ValueError(f"unknown vehicle '{self.vehicle}'")
        if self.climate == "custom":
            if not self.custom_monthly_c or len(self.custom_monthly_c) != 12:
                raise ValueError("custom_monthly_c must have 12 values")
            if any(t < -45 or t > 50 for t in self.custom_monthly_c):
                raise ValueError("temperatures must be between -45 and 50 C")
        elif self.climate not in CLIMATES:
            raise ValueError(f"unknown climate '{self.climate}'")
        return self

    def cache_key(self) -> tuple:
        """Round inputs so near-identical requests share one cached simulation."""
        temps = tuple(round(t) for t in self.custom_monthly_c) if self.climate == "custom" else ()
        return (
            self.vehicle,
            self.climate,
            temps,
            int(round(self.daily_km / 5) * 5) or 5,
            round(self.fast_charge_share * 20) / 20,  # 5 % steps
            round(self.charge_target_soc * 20) / 20,
            self.thermal_management,
        )


class YearPoint(BaseModel):
    year: float
    soh_pct: float
    range_km: float


class EstimateResponse(BaseModel):
    vehicle_label: str
    climate_label: str
    new_range_km: float
    daily_depth_of_discharge_pct: float
    curve: list[YearPoint]
    soh_at_end_pct: float
    years_to_80_pct: Optional[float]
    years_to_70_pct: Optional[float]
    second_life: str
    fade_breakdown_pct: dict[str, float]
    model: str
    cached: bool = False
    sim_seconds: float