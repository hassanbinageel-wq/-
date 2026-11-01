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
