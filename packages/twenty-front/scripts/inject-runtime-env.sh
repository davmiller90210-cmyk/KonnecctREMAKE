#!/bin/sh

echo "Injecting runtime environment variables into index.html..."

CONFIG_BLOCK=$(cat << EOF
    <script id="twenty-env-config">
      window._env_ = {
        REACT_APP_SERVER_BASE_URL: "$REACT_APP_SERVER_BASE_URL",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        REACT_APP_CLERK_PUBLISHABLE_KEY: "$REACT_APP_CLERK_PUBLISHABLE_KEY",
        REACT_APP_STREAM_API_KEY: "$REACT_APP_STREAM_API_KEY",
        STREAM_API_KEY: "$STREAM_API_KEY",
        REACT_APP_CHAT_PROVIDER: "${REACT_APP_CHAT_PROVIDER:-native}",
        REACT_APP_MATTERMOST_WEBAPP_URL: "${REACT_APP_MATTERMOST_WEBAPP_URL:-}"
      };
    </script>
    <!-- END: Konnecct Config -->
EOF
)
# Use sed to replace the config block in index.html
# Using pattern space to match across multiple lines
echo "$CONFIG_BLOCK" | sed -i.bak '
  /<!-- BEGIN: .* Config -->/,/<!-- END: .* Config -->/{
    /<!-- BEGIN: .* Config -->/!{
      /<!-- END: .* Config -->/!d
    }
    /<!-- BEGIN: .* Config -->/r /dev/stdin
    /<!-- END: .* Config -->/d
  }
' build/index.html
rm -f build/index.html.bak
