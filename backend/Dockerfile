FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Warm-up: build the model once at image build time so the first request is faster
RUN python -c "import pybamm; pybamm.lithium_ion.SPM({'SEI':'solvent-diffusion limited', 'lithium plating':'partially reversible'}); pybamm.ParameterValues('OKane2022')"

# Cloud Run provides $PORT (default 8080), 2 workers fit a 2 vCPU instance
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers ${WORKERS:-2}
