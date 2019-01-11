---
title: Uploading Client-side Files Directly to S3
date: '2016-04-18T00:30:32.169Z'
note: This post originally appeared on the site of the now defunct Vuse Media. It has been reproduced here, with modifications as necessary to remove/correct dead links.
---

The typical approach to uploading files from a client sees them
transit the files through your server, either to reside there, or to
transit on to somewhere else. This makes sense because the client
is already talking to your server, and it's easy to manage auth issues.

This model breaks down, however, not only when the files get large but also
when working with a more modern workflow where files won't be stored
locally on the server but somewhere else. Today we'll take a look
at how Vuse leveraged Amazon S3 to allow for direct uploads to S3
from the users's browser without compromising security.

### Background

The architecture for our customer control center, which allows users
to upload video to our service, revolves around a simple static
JavaScript client-side application which communicates with a
backend API server written in Python.

Incoming media files are stored on an Amazon S3 bucket before they're
picked up for transcoding and delivery to our wider content
distribution network.

Given how large customer files can be, it's a huge win both for us
and the customer if they can bypass having to transit the upload
through our API servers and go directly to our incoming S3 bucket.
It results in a quicker upload, higher reliability, and lower costs.

Of course you can't just let anyone upload anything to your S3
bucket, and you don't want to be giving away your credentials,
so it's important to do this securely. The way this is
accomplished is having the client contact the API server to announce
its intention of creating a new media file. The API server
will respond with a policy that can be used to securely
upload the file to the S3 server - this policy can
be used to upload to a particular location within a specific
bucket in a specific time window, without needing to share
your secret key.

It's important to understand that securing access to the API
endpoint that will give the client this policy as well as the
security of the data uploaded to S3 is not touched upon
in this post.

Additionally, recognize that while we use a variant of this
approach for uploading very large video files, that this
code as is can stall during large uploads. We'll have a follow
up post discussing how to resolve these issues.

Below we'll show you how to set things up on both the server and
the client.

### Generating the Policy on Your Server

Like with many things with AWS, the power of the API is only matched
by how complicated it can be. Getting this to work correctly was
a rather long effort, reading unclear and sometimes seemingly
conflicting documentation and examples on the internet. Once the
correct values and order were determined, it was all cake.

The basis of this is a series of HMAC signed messages built on
top of each other to encode important information in a secure
way. Given that, we found it worthwhile to ever so slightly
shorten the repetitive calls to `HMAC.new` by creating a
simple signing function:

```python
import hmac
import hashlib

def sign(key, msg):
  return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()
```

You'll also need to ensure that your server has access to the
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` of a user with
the ability to place files on your S3 bucket. We'll also use
two other things you'll want to configure on your server: the
`AWS_DEFAULT_REGION` and `CONTENT_UPLOAD_BUCKET`. We'll use
the Python library Yaep to load these from a `.env` file into
our environment, and then into variables. You can use whatever
you need to get them in there, Yaep isn't required.

Also, we'll go ahead and generate a UUID to act as our key on
S3. To clarify - we don't upload with the user's given filename.
This is to avoid collisions and wonky encoding issues that can
crop up when using the user provided filename. For us this is
part of a model instance describing the content, but for
the purposes of this post, we'll just generate one:

```python
key = uuid.uuid4()
```

Finally, lets load in some key values from the environment
that we'll need to use to communicate with S3:

```python
# Here we'll load several values we need in from environment
# variables.
AWS_ACCESS_KEY_ID = yaep.env(
  'AWS_ACCESS_KEY_ID',
  default=yaep.exceptions.UnsetException
).encode('utf-8')

AWS_SECRET_ACCESS_KEY = yaep.env(
  'AWS_SECRET_ACCESS_KEY',
  default=yaep.exceptions.UnsetException
).encode('utf-8')

AWS_DEFAULT_REGION = yaep.env(
  'AWS_DEFAULT_REGION',
  default=yaep.exceptions.UnsetException
).encode('utf-8')

CONTENT_UPLOAD_BUCKET = yaep.env(
  'CONTENT_UPLOAD_BUCKET',
  default=yaep.exceptions.UnsetException
).encode('utf-8')
```

With that out of the way, lets step through what's necessary to
generate the policy to return to the client.

First, we set up some date related values that we'll use:

```python
import datetime

current_date_YYYYMMDD = datetime.datetime.utcnow().strftime('%Y%m%d')
current_date = datetime.datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
expires = (
  datetime.datetime.utcnow() + datetime.timedelta(seconds=60)
).strftime('%Y-%m-%dT%H:%M:%SZ')
```

These values are largely self explanatory. One note on the `expires`
value - it's worth noting that this is for when you start uploading
the file. Once uploading, you can continue past the expiration
time. The value here of sixty seconds can be changed as you see
fit.

Next we'll want to create a credential, which ties your policy
to your `AWS_ACCESS_KEY_ID`, in a specific region, on a specific
date:

```python
# Note that as mentioned, "app" is the Flask app.

credential = '{}/{}/{}/s3/aws4_request'.format(
  AWS_ACCESS_KEY_ID,
  current_date_YYYYMMDD,
  AWS_DEFAULT_REGION
)
```

Next we'll generate the conditions, which allow us to
specify the circumstances under which this policy will
apply:

```python
conditions = [
  {'x-amz-date': current_date},
  {'x-amz-credential': credential},
  {'x-amz-algorithm': 'AWS4-HMAC-SHA256'},
  {'bucket': CONTENT_UPLOAD_BUCKET},
  ['starts-with', '$key', str(key)]
]
```

As you can see, this ties it to the current date, using the
previously constructed credential, as well as tying it to
the bucket and file. You can read the S3 documentation for
more options in configuring these conditions.

Now we set up the policy:

```python
from base64 import b64encode

policy = b64encode(json.dumps({
  'conditions': conditions,
  'expiration': expires,
}).replace('\n', '').replace('\r', '').encode('utf-8'))
```

Here we dump our conditions and expiration as JSON, removing
line breaks before we base64 encode it. This is our policy.
We just need to do a few things in order to sign it to
prove it was generated by us.

Now we'll finally get to use our handy `sign` function in
order to generate a signing key to sign our policy.

```python
date_key = sign(
  'AWS4' + AWS_SECRET_ACCESS_KEY,
  current_date_YYYYMMDD
)

date_region_key = sign(
  date_key,
  AWS_DEFAULT_REGION
)

date_region_service_key = sign(date_region_key, 's3')
signing_key = sign(date_region_service_key, 'aws4_request')
```

As you can see, we basically are just continuously signing
pieces of information. We then use this `signing_key` to
create a signing key:

```python
signature = hmac.new(signing_key, policy, hashlib.sha256).hexdigest()
```

Note here that we don't use our handy `sign` function, as
we want a hex digest of this signature, because why be
consistent?

Finally we have what we need, and we can return it to the
client:

```python
from flask import jsonify

return jsonify({
  'uuid': key,
  'policy': {
    'Policy': policy,
    'key': str(key),
    'X-Amz-Date': current_date,
    'X-Amz-Signature': signature,
    'X-Amz-Credential': credential,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'action': 'https://{}.s3.amazonaws.com/'.format(
      CONTENT_UPLOAD_BUCKET
    ),
  }
})
```

This will get returned to the client as JSON. Next we'll see
how the client can use this to upload directly to S3.

### Client-side Uploading to S3

On the client, you'll want to make a call to your API, and
create a function to handle the returned data. We'll take a
look at what the various parts of that function should do:

```JavaScript
// data is the input to our function, which is
// the data we returned from our server.

var file = $('#upload input[type=file]'),
  ext = file.val().split('.').pop(),
  s3URL = data.policy.action,
  formData = data.policy;
```

First we set up some variables. We assume that you have an
element with an id of "upload" which contains a file input
elment. We then grab the extension of the file, get the
url from the policy we got from the server. We then
create a `formData` variable from our policy returned from
the server, and this will end up being the basis for what
we send to S3.

Next, we do some housekeeping on our `formData` variable:

```JavaScript
delete formData.action;
formData.key += '.' + ext;
```

First we remove the action - we've saved that in our `s3URL`
variable. We also append the file's extension to the key
that was set serverside (the UUID if you recall). This
means that if you were uploading foo.avi, it would end
up on the bucket as UUID.avi, where the UUID is whatever
the server set it to.

The next bit is a little tricky:

```JavaScript
formData = Object.keys(data.policy).reduce(function(p, c) {
  p.append(c, data.policy[c]);
  return p;
}, new FormData());
```

Essentially, we're looking to change our `formData`
dictionary into a `FormData` JavaScript object.

Next we add our file to our new `FormData`-ified
`formData` variable:

```JavaScript
formData.append('file', file[0].files[0]);
```

Next we make a pretty standard AJAX call to initiate
our upload:

```JavaScript
$.ajax({
  type: 'POST',
  url: s3URL,
  data: formData,
  contentType: false,
  dataType: undefined,
  xhr: function() {
    var xhr = $.ajaxSettings.xhr();
    if (xhr.upload) xhr.upload.addEventListener('progress', progress);
    return xhr;
  }, // xhr
  success: success,
  error: error,
  complete: complete,
  processData: false,
});
```

This should all be fairly straight forward. The `progress`,
`success`, `error`, and `complete` variables are all
references to functions you should define to handle these
as you see fit, as you normally would on any AJAX call.

Now you should have a setup that allows you to securely
upload files to S3 from client-side JavaScript.

### Concluding Thoughts

This technique is one that works especially well in a workflow
where you need to push large data to a server other than the
one hosting your API. There are some areas you'll likely want
to tweak this setup - pay special attention to the expiration
and conditions on the server side.

Of course it's important to do things with the files when
they arrive on S3. One method might be to have the client
notify the server that the upload completed. We took a
different approach, and leveraged AWS Lambda, initiated
by S3 itself on the arrival of new files, but we'll save
that discussion for another blog post.
