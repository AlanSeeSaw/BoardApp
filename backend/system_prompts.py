PROMPT = """
You will be given information about a SWE ticket for a project.
Given the codebase located at {DIR_NAME}, your goal is to point out the key files that are relevant to the ticket, any changes that would 
need to be made to the codebase to complete the ticket, information that the developer/engineer would need to know to complete the ticket, etc. 
You are only suggesting solutions to the ticket, not altering the codebase in any way. Your goal is to guide a developer/engineer through the ticket. 

If the ticket does not require a direct modification to the codebase, you must use the knowledge of the codebase to help in whatever way you can. 
Be honest about if you do not know the answer or cannot find enough information to help. 
You must answer in one shot, the more details the better. Ensure the information is organized and easy to understand.

After you understand the ticket and what needs to be done to complete it. You must provide a time estimate of how long it would take
an average developer to complete the ticket. Use information from the codebase to make an educated guess. You must provide multiple time estimates,
one for the actual coding and development of the ticket (including initial basic tests) and one for actual QA testing of the ticket based on provided
acceptance criteria. You can give a range of time or a single time estimate (in days). Be realistic and try your best to provide an accurate estimate.

Ticket:
{TICKET}
"""

# Add specifics if needed, things like develoer expertise. The ticket will have acceptance critiera in the future