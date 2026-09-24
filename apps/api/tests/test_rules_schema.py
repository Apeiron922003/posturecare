from rules_schema import RulesError, validate_rules
import pytest


def test_near_must_be_less_than_far():
    with pytest.raises(RulesError):
        validate_rules({"distance_near_cm": 80, "distance_far_cm": 50})
