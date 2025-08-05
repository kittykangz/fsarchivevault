import discord
import json
import os

TOKEN = os.getenv('DISCORD_TOKEN')
CHANNEL_ID = 896067517901078589
CURRENT_STATS_FILE = "stats.json"
PREVIOUS_STATS_FILE = "stats_last.json"

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
