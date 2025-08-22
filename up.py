import discord
import json
import os
from collections import defaultdict

TOKEN = os.getenv('DISCORD_TOKEN')
CHANNEL_ID = 896067517901078589
CURRENT_STATS_FILE = "stats.json"
PREVIOUS_STATS_FILE = "stats_last.json"
DIFF_FILE = "member_diffs.json"

intents = discord.Intents.default()
client = discord.Client(intents=intents)

@client.event
async def on_ready():
    print(f"Logged in as {client.user}")

    try:
        # Load current stats
        with open(CURRENT_STATS_FILE, "r") as f:
            current = json.load(f)

        total_images = current.get("images", 0)
        last_updated = current.get("last_updated", "unknown")

        # Load previous stats if available
        if os.path.exists(PREVIOUS_STATS_FILE):
            with open(PREVIOUS_STATS_FILE, "r") as f:
                previous = json.load(f)
            prev_total_images = previous.get("images", 0)
        else:
            prev_total_images = 0

        new_images = total_images - prev_total_images
        added_msg = (
            f"➕ {new_images:,} new images added" if new_images > 0
            else "No new images added"
        )

        msg = (
            "✨ **Fan Site Gallery Updated!**\n"
            f"{added_msg}\n"
            f"🌷 Total images: {total_images:,}\n"
            f"🫧 Last updated: {last_updated}\n"
            f"🔗 https://kittykangz.github.io/fsarchivevault"
        )

        # Load member diffs
        if os.path.exists(DIFF_FILE):
            with open(DIFF_FILE, "r") as f:
                diffs = json.load(f)

            if diffs:
                # Group members under their group name
                grouped = defaultdict(list)
                for full_name, count in diffs.items():
                    if "/" in full_name:
                        group, member = full_name.split("/", 1)
                    else:
                        group, member = "Other", full_name
                    grouped[group].append((member, count))

                # Compute total new per group and sort groups by most additions
                sorted_groups = sorted(
                    grouped.items(),
                    key=lambda g: sum(count for _, count in g[1]),
                    reverse=True
                )

                lines = ["```"]  # monospace block
                for idx, (group, members) in enumerate(sorted_groups):
                    group_total = sum(count for _, count in members)
                    # Sort members within group by additions
                    sorted_members = sorted(members, key=lambda x: x[1], reverse=True)

                    # Join members with commas
                    member_strs = ", ".join(f"{member} +{count}" for member, count in sorted_members)

                    # Add group line
                    lines.append(f"{group} (+{group_total})".ljust(20) + f"| {member_strs}")

                    # Add empty line between groups except the last
                    #if idx < len(sorted_groups) - 1:
                        #lines.append("")

                lines.append("```")

                msg += "\n\n" + "\n".join(lines)

        # Send message
        channel = client.get_channel(CHANNEL_ID)
        if channel:
            await channel.send(msg)
        else:
            print("Channel not found")

    except Exception as e:
        print(f"Error: {e}")

    await client.close()

client.run(TOKEN)
