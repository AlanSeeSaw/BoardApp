PROMPT = """
You will be given information about a SWE card for a project.
Given the codebase located at {DIR_NAME}, your goal is to point out the key files that are relevant to the card, any changes that would 
need to be made to the codebase to complete the card, information that the developer/engineer would need to know to complete the card, etc. 
You are only suggesting solutions to the card, not altering the codebase in any way. Your goal is to guide a developer/engineer through the card. 

If the card does not require a direct modification to the codebase, you must use the knowledge of the codebase to help in whatever way you can. 
Be honest about if you do not know the answer or cannot find enough information to help. 
You must answer in one shot, the more details the better. Ensure the information is organized and easy to understand.

After you understand the card and what needs to be done to complete it. You must provide a time estimate of how long it would take
an average developer to complete the card. Use information from the codebase to make an educated guess. You must provide multiple time estimates,
one for the actual coding and development of the card (including initial basic tests) and one for actual QA testing of the card based on provided
acceptance criteria. You can give a range of time or a single time estimate (in days). Be realistic and try your best to provide an accurate estimate.

You must return a JSON object with the following format:
{
    "card_help": "{card help}",
    "time_estimates": {
        "coding": "{# of days}",
        "qa": "{# of days}"
    }
}

card:
{CARD}
"""

# Add specifics if needed, things like develoer expertise. The card will have acceptance critiera in the future