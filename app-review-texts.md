# Shayyek — Meta App Review texts (English)

App: shayyek.sa (ID 1703468354087092) · Business: Kora Touch For Trading Est · Website: https://shayyek.sa

---

## 1) instagram_business_basic

**How will your app use this permission?**

Shayyek (https://shayyek.sa) is a web app for Saudi businesses to automate replies on their own Instagram professional account.
We use instagram_business_basic to:

1. Identify the Instagram professional account the business owner connected through Instagram Login, and show its username, profile picture and account ID on the «Connection» page, so the owner can confirm which account is connected.
2. List the connected account's own posts and reels (ID, caption, thumbnail, permalink, timestamp) so the owner can choose which post a comment-reply campaign applies to.
3. Get the account's Instagram user ID, required for webhooks and for the Instagram Messaging API.

We only read data of the account its owner connected. The owner can disconnect at any time and request deletion of their data (https://shayyek.sa/data-deletion).

**Screencast:** `review-1-connect-instagram_business_basic.mp4`

1. The owner signs in at shayyek.sa.
2. The dashboard shows that no Instagram account is connected yet.
3. The owner opens «Connection» and taps «Connect Instagram».
4. Instagram's consent screen lists the five permissions, and the owner taps Allow.
5. Shayyek receives the callback, and the account is connected.
6. Shayyek shows the connected account: @finjan.house, its profile picture and its ID.
   Choosing one of the account's posts is shown in the comments video.

---

## 2) instagram_business_manage_comments

**How will your app use this permission?**

Businesses use Shayyek to answer comments on their own posts automatically. The owner creates a «campaign» on one of their posts with keywords (for example "price"). When someone comments with a keyword:

1. Shayyek receives the comment through the `comments` webhook field.
2. Shayyek reads the comment text to match the keyword.
3. Shayyek posts one short public reply under that comment (for example "We sent you the details in DM").
4. Shayyek sends one private reply to the commenter with the requested info (price and a link). The private reply uses instagram_business_manage_messages.

In the screencast the link is shayyek.sa because this is a test account. Real businesses put their own store or product link.

The campaign page counts how many people commented and how many received the reply. We only act on comments on the connected account's own media. We reply once per comment and limit repeats per person.

**Screencast:** `review-2-comments-instagram_business_manage_comments.mp4`

1. The owner creates a comment campaign and picks one of @finjan.house's posts. Shayyek lists the account's media.
2. The owner sets the keywords, the private-reply content with a link button, and the public reply.
3. The owner activates the campaign. Its counters show 0.
4. On a phone, another Instagram account comments the keyword.
5. Shayyek replies publicly under the comment.
6. The commenter receives the private reply with an "Open link" button.
7. On instagram.com, the comment and Shayyek's public reply appear under the post.
8. The campaign card shows 1 person, 1 delivered and a 100% delivery rate.

---

## 3) instagram_business_manage_messages

**How will your app use this permission?**

Shayyek lets a business handle Instagram Direct messages with its customers:

1. **Private reply to a comment.** When a campaign matches a comment, Shayyek sends one private reply to the commenter (Send API with recipient.comment_id). The reply contains the information the person asked for, such as a price and a link button.
2. **Inbox.** Shayyek's «Messages» page shows conversations with the connected account. The business owner reads them and sends manual replies from Shayyek. Manual replies are allowed only within the 24-hour messaging window, and Shayyek shows the time left.
3. **Story replies and mentions.** Shayyek answers story replies and story mentions in the same way, inside the messaging window.

Shayyek only messages people who contacted the business first: they commented, replied to a story or sent a message. It never sends unsolicited or promotional broadcasts. Incoming messages arrive through the `messages` and `messaging_postbacks` webhook fields.

**Screencast:** `review-3-messages-instagram_business_manage_messages.mp4`

1. On a phone, the customer's Instagram DMs show the private reply the campaign sent after the comment.
2. In Shayyek, the owner opens «Messages» and the conversation.
3. The owner sends a manual reply. It is within 24 hours of the customer's last message.
4. On the phone, the reply arrives, and the customer answers "thanks".
5. The customer's answer appears in the Shayyek inbox.

---

## 4) instagram_business_content_publish

**How will your app use this permission?**

Shayyek has a «Scheduling» calendar where a business owner plans posts, reels and stories for their own Instagram professional account.

1. The owner uploads the media and writes the caption.
2. The owner picks a date and time.
3. At that time Shayyek publishes it with the Content Publishing API: it creates a media container, then publishes it.
4. The calendar shows the status: Scheduled, Publishing, Published or Failed.

Shayyek publishes only content the owner created and scheduled, only to the account they connected, and never on its own initiative.

**Screencast:** `review-4-publish-instagram_business_content_publish.mp4`

1. The owner opens «Scheduling» and creates a post with an image and a caption.
2. The owner sets it for 11:55 PM. The computer clock shows 11:49 PM.
3. The post appears as Scheduled. The 6-minute wait was cut from the video.
4. At 11:55 Shayyek publishes it, and the status turns Published. The clock shows 11:56 PM.
5. On instagram.com, the new post is the first post on @finjan.house's profile.

---

## 5) instagram_business_manage_insights

**How will your app use this permission?**

Shayyek's «Analytics» page helps a business see how its own Instagram content performs.
Once an hour, Shayyek reads the connected account's insights from the Instagram Insights API:

- Account level: views, reach (followers and non-followers), interactions and follower changes.
- Per post, reel and story: views, reach, likes, comments, shares and saves.

Shayyek shows these numbers next to the results of the business's own comment campaigns, so the owner can see which posts bring interactions and orders.
We only read insights of the account its owner connected. We use them only to show these reports to that owner, and we never share or sell them.

**Screencast:** `review-5-insights-instagram_business_manage_insights.mp4`

1. The owner opens «Analytics».
2. The «Instagram insights» card shows the account totals: 17 views, 2 comments, and reach split into followers and non-followers.
3. «Post performance» lists each post's insights. The cold-coffee post has 10 views and 2 comments.
4. The rest of the page combines campaign results with the posts' insights.
5. On instagram.com, the same post's "View insights" shows 10 views, 2 interactions and 2 comments, the same numbers Shayyek shows.

---

## Test instructions (for the reviewer) — draft

1. Open https://shayyek.sa and sign in with the test login provided in this form.
   The interface is in Arabic. The screencasts have English captions for every step.
2. The test account is already connected to the Instagram professional account @finjan.house, which has the Instagram Tester role.
3. To test comments and messages, comment the word "price" on one of @finjan.house's posts from any Instagram account.
   - A public reply appears under the comment.
   - A private message arrives with the price and a link.
4. «الرسائل» (Messages) shows the conversation, and the reviewer can send a manual reply within 24 hours.
5. «الجدولة» (Scheduling) publishes a post to @finjan.house.
6. «التحليلات» (Analytics) shows the account's and posts' insights.

> The test login itself is entered in Meta's form only — never shared here.
