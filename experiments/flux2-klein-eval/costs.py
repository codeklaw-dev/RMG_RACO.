"""Cost accounting from measured seconds, using Modal's per-second prices."""
import config


def rate_per_s(gpu, cores=config.CONTAINER_CPU_CORES, mem_gib=config.CONTAINER_MEM_GIB):
    if gpu not in config.GPU_PRICE_PER_S:
        raise ValueError("unknown GPU: %s" % gpu)
    return config.GPU_PRICE_PER_S[gpu] + cores * config.CPU_PRICE_PER_CORE_S + mem_gib * config.MEM_PRICE_PER_GIB_S


def cost_usd(gpu, billed_seconds):
    return round(rate_per_s(gpu) * billed_seconds, 6)


class BudgetGuard:
    """Stops a benchmark before a planned step could push spend over the cap."""

    def __init__(self, cap_usd):
        if cap_usd <= 0:
            raise ValueError("budget must be positive")
        self.cap = cap_usd
        self.spent = 0.0

    def can_afford(self, gpu, planned_seconds):
        return self.spent + cost_usd(gpu, planned_seconds) <= self.cap

    def charge(self, gpu, billed_seconds):
        self.spent = round(self.spent + cost_usd(gpu, billed_seconds), 6)
        return self.spent

    @property
    def remaining(self):
        return round(self.cap - self.spent, 6)
