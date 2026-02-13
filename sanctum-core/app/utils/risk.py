def calculate_vendor_risk_score(security_score: int, data_level: str, compliance: str) -> float:
    """
    The Oracle Algorithm:
    - Base: (100 - security_score) * 0.4
    - Data Weight: Internal (10), Confidential (30), Restricted (60)
    - Penalty: Non-compliant vendors get a 1.5x multiplier
    """
    data_weights = {
        "none": 0,
        "internal": 10,
        "confidential": 30,
        "restricted": 60
    }
    
    base_risk = (100 - security_score) * 0.4
    data_risk = data_weights.get(data_level.lower(), 0) * 0.6
    
    total_risk = base_risk + data_risk
    
    if compliance.lower() != "compliant":
        total_risk *= 1.5
        
    return round(min(total_risk, 100), 2)