from enum import IntEnum

class UserPriority(IntEnum):
    PREMIUM = 0     # Premium/Paid users
    VERIFIED = 1    # Verified users
    REGULAR = 2     # Regular users
    FREE = 3        # Free tier users
