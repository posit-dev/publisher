#!/usr/bin/env python3

#
# Python script that uses the Posit Connect Server API to enumerate content to
# a Posit Connect server.
#
# Environment variables:
#
# * CONNECT_SERVER - The URL for your Posit Connect installation.
#
# * CONNECT_API_KEY - A Posit Connect API key.
#
# * FEATURED_TAGS - A comma-separated list of tag names. Content using any of
#   these tags is featured.
#
# Example configuration:
#
#     CONNECT_SERVER="https://connect.company.com/"
#     CONNECT_API_KEY="NM6ZI4vluEHsyg5ViV3zK2bhBGqjiayA"
#     FEATURED_TAGS="showcase"
#
# Produces two YAML files used by the Quarto website:
#
# * featured.yaml - YAML file listing content to feature on the landing page.
#
# * all.yaml - YAML file listing all available content.
#

import os
import sys
import requests
import yaml

connectServer = os.getenv("CONNECT_SERVER")
if not connectServer:
    print("ERROR: Environment variable CONNECT_SERVER must be defined.")
    sys.exit(1)

connectAPIKey = os.getenv("CONNECT_API_KEY")
if not connectAPIKey:
    print("ERROR: Environment variable CONNECT_API_KEY must be defined.")
    sys.exit(1)

featuredTags = os.getenv("FEATURED_TAGS")
if featuredTags is not None:
    featuredTags = [tag.strip() for tag in featuredTags.split(",")]
    featuredTags = [tag for tag in featuredTags if tag]

# Ensure that connectServer has a trailing slash.
if connectServer[-1] != "/":
    connectServer = connectServer + "/"


def text_escape(text):
    """
    Helper to escape some characters that present problems if they appear
    in the Quarto listing YAML text.

    See: https://github.com/quarto-dev/quarto-cli/issues/6745
    """
    return text.replace("&", "&amp;").replace("@", "&commat;").replace("$", "&dollar;")


def default_icon(item):
    """
    Returns an icon appropriate for the content item.
    """
    app_mode = item["app_mode"]
    content_category = item["content_category"]
    if app_mode == "api":
        return "api.svg"
    elif app_mode == "shiny":
        return "app.svg"
    elif app_mode == "rmd-shiny":
        return "doc.svg"
    elif app_mode == "quarto-shiny":
        return "doc.svg"
    elif app_mode == "rmd-static":
        return "doc.svg"
    elif app_mode == "quarto-static":
        return "doc.svg"
    elif app_mode == "tensorflow-saved-model":
        return "model.svg"
    elif app_mode == "python-api":
        return "api.svg"
    elif app_mode == "python-dash":
        return "app.svg"
    elif app_mode == "python-gradio":
        return "app.svg"
    elif app_mode == "python-streamlit":
        return "app.svg"
    elif app_mode == "python-bokeh":
        return "app.svg"
    elif app_mode == "python-shiny":
        return "app.svg"
    elif app_mode == "static":
        if content_category == "plot":
            return "plot.svg"
        elif content_category == "pin":
            return "pin.svg"

    return "doc.svg"


def content_image(item):
    """
    Returns the path to an image for this content item. By default, this
    uses an icon associated with the type of content.
    """
    return f"icons/{default_icon(item)}"


def listing_item_from_content(item):
    """
    Helper to transform a content item returned by the Posit Connect
    Server API into an entry that is compatible with the Quarto document
    listing YAML.
    """
    title = item["title"]
    if not title:
        title = item["name"]

    owner = item["owner"]

    record = {
        "guid": item["guid"],
        "app_mode": item["app_mode"],
        "content_category": item["content_category"],
        "title": text_escape(title),
        "author": text_escape(f'{owner["first_name"]} {owner["last_name"]}'),
        "date": item["last_deployed_time"],
        # href? filename? path?
        "path": item["content_url"],
        "image": content_image(item),
    }

    if item["description"]:
        record["description"] = text_escape(item["description"])

    tags = item.get("tags")
    if tags:
        record["categories"] = [tag["name"] for tag in tags]

    return record


def listing_items_from_content(items):
    """
    Helper to transform a list of content items returned by the Posit
    Connect Server API into a collection that is compatible with the Quarto
    document listing YAML.
    """
    return [listing_item_from_content(item) for item in items]


def filter_listing(listing, tags):
    """
    helper that returns listing entries that reference any tag.
    """
    tagset = set(tags)
    return [item for item in listing if tagset.intersection(item.get("categories", []))]


def write_yaml(filename, listing):
    """
    Helper that writes a YAML file from a set of listing records that are
    compatible with the Quarto document listing format.
    """
    with open(filename, "w") as f:
        yaml.safe_dump(listing, f)


# List all content.
# https://docs.posit.co/connect/api/#get-/v1/content
r = requests.get(
    f"{connectServer}__api__/v1/content",
    params={
        "include": "tags,owner",
    },
    headers={
        "Authorization": "Key " + connectAPIKey,
    },
)
r.raise_for_status()
payload = r.json()

# payload = payload[:100]
listing = listing_items_from_content(payload)
print(f"Fetched {len(listing)} items.")
write_yaml("all.yaml", listing)

# When we have featured tags, show only content that uses those tags.
# Otherwise, show the 20 most recent items.
featured = []
if featuredTags:
    print("Featuring items having tags: %s" % ", ".join(featuredTags))
    featured = filter_listing(listing, featuredTags)
    print(f"Filtering by tags selected {len(featured)} items.")
if not featured:
    print("No featured tags, or no matching items. Featuring 20 most recent items")
    featured = listing[:20]
write_yaml("featured.yaml", featured)
