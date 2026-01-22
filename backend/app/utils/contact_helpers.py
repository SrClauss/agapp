"""
Contact utility functions for shared business logic.
"""

from typing import Dict, Any, List


def is_first_user_message(contact_messages: List[Dict[str, Any]]) -> bool:
    """
    Check if the contact has only one user message (excluding system messages).
    
    This is used to determine if a contact should be marked as "in_conversation"
    after the first real message is sent.
    
    Args:
        contact_messages: List of message dictionaries from the contact's chat array
        
    Returns:
        True if there is exactly one non-system message, False otherwise
    """
    user_messages = [msg for msg in contact_messages if not msg.get("system", False)]
    return len(user_messages) == 1
