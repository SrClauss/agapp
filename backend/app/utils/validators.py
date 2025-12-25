from typing import List
from app.core.database import get_database
from app.crud.user import get_user_by_email

async def validate_user_credits(user_id: str, required_credits: int = 1) -> bool:
    db = await get_database()
    from app.crud.subscription import get_user_subscription
    subscription = await get_user_subscription(db, user_id)
    if not subscription or subscription.credits < required_credits:
        return False
    return True

async def validate_email_unique(email: str, exclude_user_id: str = None) -> bool:
    db = await get_database()
    user = await get_user_by_email(db, email)
    if user and (exclude_user_id is None or str(user.id) != exclude_user_id):
        return False
    return True

def validate_roles(roles: List[str]) -> bool:
    valid_roles = ["client", "professional", "admin"]
    return all(role in valid_roles for role in roles)


def is_valid_cpf(cpf: str | None) -> bool:
    """Valida CPF básico: apenas dígitos, 11 caracteres e dígitos verificadores."""
    if not cpf:
        return False
    digits = ''.join(ch for ch in str(cpf) if ch.isdigit())
    if len(digits) != 11:
        return False
    # Rejeita CPFs com todos dígitos iguais
    if digits == digits[0] * 11:
        return False

    def calc(nums: list[int]) -> int:
        s = 0
        for i, n in enumerate(nums):
            s += n * (len(nums) + 1 - i)
        r = (s * 10) % 11
        return 0 if r == 10 else r

    nums = [int(c) for c in digits]
    d1 = calc(nums[:9])
    d2 = calc(nums[:10])
    return d1 == nums[9] and d2 == nums[10]


def is_temporary_cpf(cpf: str | None) -> bool:
    """Detecta CPFs temporários (todos zeros) ou ausentes.

    Considera temporário valores como '000.000.000-00' ou strings compostas apenas de zeros.
    """
    if not cpf:
        return True
    digits = ''.join(ch for ch in str(cpf) if ch.isdigit())
    if len(digits) != 11:
        return True
    # Se todos os dígitos forem '0', consideramos temporário
    return digits == '0' * 11