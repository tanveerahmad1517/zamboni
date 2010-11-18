$(document).ready(function() {

    //Ownership
    if ($("#author_list").length) {
        initAuthorFields();
    }

    //Payments
    if ($('.payments').length) {
        initPayments();
    }

    // Edit Versions
    if($('#upload-file').length) {
        initEditVersions();
    }

    // View versions
    if($('#version-list').length) {
        initVersions();
    }

    // Submission process
    if($('.addon-submission-process').length) {
        initSubmit();
    }
});


$(document).ready(function() {
    $.ajaxSetup({cache: false});

    $('.more-actions-popup').popup('.more-actions', {
        width: 'inherit',
        offset: {x: 15},
        callback: function(obj) {
            return {pointTo: $(obj.click_target)};
        }
    });

    truncateFields();

    initCompatibility();

    $('#edit-addon').delegate('h3 a', 'click', function(e){
        e.preventDefault();

        parent_div = $(this).closest('.edit-addon-section');
        a = $(this);

        (function(parent_div, a){
            parent_div.load($(a).attr('data-editurl'), addonFormSubmit);
        })(parent_div, a);
    });

    $('.addon-edit-cancel').live('click', function(){
        parent_div = $(this).closest('.edit-addon-section');
        parent_div.load($(this).attr('href'), z.refreshL10n);
        return false;
    });
});


function truncateFields() {
    var els = [
            "#addon_description",
            "#developer_comments"
        ];
    $(els.join(', ')).each(function(i,el) {
        var $el = $(el),
            originalHTML = $el.html();
        $el.delegate("a.truncate_expand", "click", function(e) {
            e.preventDefault();
            $el.html(originalHTML).css('max-height','none');
        })
        .vtruncate({
            truncText: format("&hellip; <a href='#' class='truncate_expand'>{0}</a>",[gettext("More")])
        });
    });
}


function addonFormSubmit() {
    parent_div = $(this);

    (function(parent_div){
        $('form', parent_div).submit(function(){
        $.post($(parent_div).find('form').attr('action'),
                $(this).serialize(), function(d){
                    $(parent_div).html(d).each(addonFormSubmit);
                    truncateFields();
                });
            return false;
        });
        z.refreshL10n();
    })(parent_div);
}


$("#user-form-template .email-autocomplete")
    .attr("placeholder", gettext("Enter a new author's email address"));


function initVersions() {
    $('#modals').hide();

    $('#modal-delete-version').modal('.version-delete .remove',
        { width: 400,
          callback:function(d){
                $('.version_id', this).val($(d.click_target).attr('data-version'));
                return true;
            }
          });

    $('#modal-cancel').modal('#cancel-review',
        { width: 400
          });


    $('#modal-delete').modal('#delete-addon',
        { width: 400,
          });


    $('#modal-disable').modal('#disable-addon',
        { width: 400,
          });


}

function initSubmit() {
    $('#submit-describe form').delegate('#id_name', 'keyup', slugify)
        .delegate('#id_name', 'blur', slugify)
        .delegate('#edit_slug', 'click', show_slug_edit)
        .delegate('#id_slug', 'change', function() {
            $('#id_slug').attr('data-customized', 1);
            if (!$('#id_slug').val()) {
                $('#id_slug').attr('data-customized', 0);
                slugify;
            }
        });
    $('#id_slug').each(slugify);
}

function initEditVersions() {
    var file = {},
        xhr = false;

    // Hide the modal
    $('.upload-status').hide();

    // Modal box
    $modal = $(".add-file-modal").modal(".add-file", {
        width: '450px',
        hideme: false,
        callback: resetModal
    });

    // Cancel link
    $('.upload-file-cancel').click(function(e) {
        e.preventDefault();
        $modal.hideMe();
    });

    // Abort upload
    $('#uploadstatus_abort a').click(abortUpload);

    // Upload form submit
    $("#upload-file").delegate("#upload-file-input", 'change', function(e) {
        resetModal(false);
        fileUpload($(this), $(this).closest('form').attr('action'));
        $('.upload-status').show();
    });

    $("#upload-file-finish").click(function (e) {
        e.preventDefault();
        $tgt = $(this);
        if ($tgt.attr("disabled")) return;
        $.post($tgt.attr("data-url"), $("#upload-file").serialize(), function (resp) {
            $("#file-list tbody").append(resp);
            $("#id_files-TOTAL_FORMS").val($("#file-list tr").length);
            $modal.hideMe();
        });
    });

    $("#file-list").delegate("a.remove", "click", function() {
        $tr = $(this).closest("tr").first();
        $tr.hide().find(".delete input").attr("checked", "checked");
        $("#id_files-TOTAL_FORMS").val($("#file-list tr").length);
    });

    function fileUpload(img, url) {
        var f = img[0].files[0];

        file = {};
        file.name = f.name || f.fileName;
        file.size = f.size;
        file.data = '';
        file.aborted = false;

        // Make sure it's an xpi or jar.

        if(!file.name.match(/\.(xpi|jar)$/i)) {
            error = gettext("The package is not of a recognized type.");
            j = {};
            j.validation = {"errors":1, "messages":[]};
            j.validation.messages.push({"type":"error", "message":error});

            addonUploaded(j, file);
            return false;
        }

        // Prepare the progress bar and status

        text = format(gettext('Preparing {0}'), [file.name]);
        $('#upload-status-text').text(text);

        updateStatus(0);

        // Wrap in a setTimeout so it doesn't freeze the browser before
        // the status above can be set.

        setTimeout(function(){
            xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", function(e) {
                if (e.lengthComputable) {
                    var pct = Math.round((e.loaded * 100) / e.total) + "%";
                    $('#upload-status-bar div').animate({'width': pct},
                        {duration: 500, step:updateStatus });
                }
            }, false);

            var token = $("#upload-file input[name=csrfmiddlewaretoken]").val();

            xhr.open("POST", url, true);

            xhr.onreadystatechange = onupload;
            xhr.setRequestHeader("Content-Type", "application/octet-stream");

            xhr.setRequestHeader("Content-Length", file.size);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

            xhr.setRequestHeader('Content-Disposition', 'file; name="upload";');
            xhr.setRequestHeader("X-File-Name", file.name);
            xhr.setRequestHeader("X-File-Size", file.size);

            xhr.send(f);
        }, 10);

        return true;
    }

    function abortUpload(e) {
       e.preventDefault();
       file.aborted = true;
       if(xhr) xhr.abort();
    }

    function textSize(bytes) {
        // Based on code by Cary Dunn (http://bit.ly/d8qbWc).
        var s = ['bytes', 'kb', 'MB', 'GB', 'TB', 'PB'];
        if(bytes == 0) return bytes + " " + s[1];
        var e = Math.floor( Math.log(bytes) / Math.log(1024) );
        return (bytes / Math.pow(1024, Math.floor(e))).toFixed(2)+" "+s[e];
    }

    function updateStatus( percentage ) {
        p = Math.round(percentage);
        size = (p / 100) * file.size;
        // L10n: {0} is the percent of the file that has been uploaded.
        $('#uploadstatus_percent').text(format(gettext('{0}% complete'), [p]));
        // L10n: "{bytes uploaded} of {total filesize}".
        $('#uploadstatus_progress').text(format(gettext('{0} of {1}'),
                                                [textSize(size),
                                                 textSize(file.size)]))
                                   .attr({'value': size, 'max': file.size});
    }


    function onupload() {
        if(xhr.readyState == 4) $('#uploadstatus_abort').hide();

        if (xhr.readyState == 4 && xhr.responseText &&
            (xhr.status == 200 || xhr.status == 304)) {
            $('#upload-status-bar div').animate({'width': '100%'},
                {duration: 500,
                 step:updateStatus,
                 complete: function() {
                    text = format(gettext('Validating {0}'), [file.name]);
                    $('#upload-status-text').text(text);

                    $(this).parent().addClass('progress-idle');

                    try {
                        json = JSON.parse(xhr.responseText);
                    } catch(err) {
                        // The server isn't returning proper JSON
                        error = gettext("There was an error with your upload.");
                        addonError(error);
                        return false;
                    }

                    addonUploaded(json);
                    }
                });
        } else if(xhr.readyState == 4) {
            // Some sort of error, so display error and prompt them for round 2
            if(file.aborted) {
                addonError(gettext("You aborted the add-on upload."));
            } else {
                addonError(gettext("We were unable to connect to the server."));
            }


        }
    }

    function addonError(message) {
        $('#upload-status-bar').removeClass('progress-idle')
                               .addClass('bar-fail');
        $('#upload-status-bar div').fadeOut();

        body = "<strong>" + message + "</strong>";

        $('#upload-status-results').html(body).addClass('status-fail');
        $('.upload-status-button-add').hide();
        $('.upload-status-button-close').show();
    }

    function resetModal(fileInput) {
        if (fileInput === undefined) fileInput = true;

        file = {name: '', size: 0, data: '', aborted: false};

        $('.upload-file-box').show();
        $('.upload-status').hide();

        $('.upload-status-button-add').show();
        $('.upload-status-button-close').hide();

        $('#upload-status-bar').attr('class', '');
        $('#upload-status-text').text("");
        if (fileInput) resetFileInput(); // Clear file input
        $('#upload-status-results').text("").attr("class", "");
        $('#upload-status-bar div').css('width', 0).show();
        $('#upload-status-bar').removeClass('progress-idle');
        $("#upload-file-finish").attr("disabled", true);


        updateStatus(0);
        $('#uploadstatus_abort').show();

        return true;
    }

    function resetFileInput() {
        upload = $("<input type='file'>").attr('name', 'upload')
                                         .attr('id', 'upload-file-input');
        $('#upload-file-input').replaceWith(upload); // Clear file input
    }

    function addonUploaded(json) {
        $('#uploadstatus_abort').hide();

        v = json.validation;

        if(!v) {
            setTimeout(function(){
                $.getJSON(json.url, addonUploaded);
            }, 1000);
        } else {
            $('#upload-status-bar').removeClass('progress-idle')
                                   .addClass('bar-' +
                                             (v.errors ? 'fail' : 'success'));
            $('#upload-status-bar div').fadeOut();

            text = format(gettext('Validated {0}'), [file.name]);
            $('#upload-status-text').text(text);

            // TODO(gkoberger): Use templates here, rather than +'s

            var body = "<strong>";
            if(!v.errors) {
                $("#upload-file-finish").attr("disabled", false);
                $("#id_upload").val(json.upload);
                body += format(ngettext(
                        "Your add-on passed validation with no errors and {0} warning.",
                        "Your add-on passed validation with no errors and {0} warnings.",
                        v.warnings), [v.warnings]);
            } else {
                body += format(ngettext(
                        "Your add-on failed validation with {0} error.",
                        "Your add-on failed validation with {0} errors.",
                        v.errors), [v.errors]);
            }
            body += "</strong>";

            body += "<ul>";
            if(v.errors) {
                $.each(v.messages, function(k, t) {
                    if(t.type == "error") {
                        body += "<li>" + t.message + "</li>";
                    }
                });
            }
            body += "</ul>";

            // TODO(gkoberger): Add a link when it becomes available

            body += "<a href='#'>";
            body += gettext('See full validation report');
            body += '</a>';

            statusclass = v.errors ? 'status-fail' : 'status-pass';
            $('#upload-status-results').html(body).addClass(statusclass);
            resetFileInput();
        }

    }
}

function initPayments() {
    var previews = [
        "img/zamboni/contributions/passive.png",
        "img/zamboni/contributions/after.png",
        "img/zamboni/contributions/roadblock.png",
    ],
        media_url = $("body").attr("data-media-url"),
        to = false,
        img = $("<img id='contribution-preview'/>");
        moz = $("input[value=moz]");
    img.hide().appendTo($("body"));
    moz.parent().after(
        $("<a class='extra' target='_blank' href='http://www.mozilla.org/foundation/donate.html'>"+gettext('Learn more')+"</a>"));
    $(".nag li label").each(function (i,v) {
        var pl = new Image();
        pl.src = media_url + previews[i];
        $(this).after(format(" &nbsp;<a class='extra' href='{0}{1}'>{2}</a>", [media_url, previews[i], gettext('Example')]));
    });
    $(".nag").delegate("a.extra", "mouseover", function(e) {
        var tgt = $(this);
        img.attr("src", tgt.attr("href")).css({
            position: 'absolute',
            'pointer-events': 'none',
            top: tgt.offset().top-350,
            left: ($(document).width()-755)/2
        });
        clearTimeout(to);
        to = setTimeout(function() {
            img.fadeIn(100);
        }, 300);
    }).delegate("a.extra", "mouseout", function(e) {
        clearTimeout(to);
        img.fadeOut(100);
    })
    .delegate("a.extra", "click", function(e) {
        e.preventDefault();
    });
    $("#do-setup").click(function (e) {
        e.preventDefault();
        $("#setup").removeClass("hidden").show();
        $(".intro").hide();
    });
    $("#setup-cancel").click(function (e) {
        e.preventDefault();
        $(".intro").show();
        $("#setup").hide();
    });
    $(".recipient").change(function (e) {
        var v = $(this).val();
        $(".paypal").hide(200);
        $(format("#org-{0}", [v])).removeClass("hidden").show(200);
    });
    $("#id_enable_thankyou").change(function (e) {
        if ($(this).attr("checked")) {
            $(".thankyou-note").show().removeClass("hidden");
        } else {
            $(".thankyou-note").hide();
        }
    }).change();
}


function initAuthorFields() {
    var request = false,
        timeout = false,
        manager = $("#id_form-TOTAL_FORMS"),
        empty_form = template($("#user-form-template").html().replace(/__prefix__/g, "{0}")),
        author_list = $("#author_list");
    author_list.sortable({
        items: ".author",
        handle: ".handle",
        containment: author_list,
        tolerance: "pointer",
        update: renumberAuthors
    });
    addAuthorRow();

    $("#id_has_eula").change(function (e) {
        if ($(this).attr("checked")) {
            $(".eula").show().removeClass("hidden");
        } else {
            $(".eula").hide();
        }
    });
    $("#id_has_priv").change(function (e) {
        if ($(this).attr("checked")) {
            $(".priv").show().removeClass("hidden");
        } else {
            $(".priv").hide();
        }
    });
    var other_val = $(".license-other").attr("data-val");
    $(".license").click(function (e) {
        if ($(this).val() == other_val) {
            $(".license-other").show().removeClass("hidden");
        } else {
            $(".license-other").hide();
        }
    });

    $(".author .errorlist").each(function() {
        $(this).parent()
            .find(".email-autocomplete")
            .addClass("tooltip")
            .addClass("invalid")
            .addClass("formerror")
            .attr("title", $(this).text());
    });

    $("#author_list").delegate(".email-autocomplete", "keypress", validateUser)
    .delegate(".email-autocomplete", "keyup", validateUser)
    .delegate(".remove", "click", function (e) {
        e.preventDefault();
        var tgt = $(this),
            row = tgt.parents("li");
        if (author_list.children(".author:visible").length > 1) {
            if (row.hasClass("initial")) {
                row.find(".delete input").attr("checked", "checked");
                row.hide();
            } else {
                row.remove();
                manager.val(author_list.children(".author").length);
            }
            renumberAuthors();
        }
    });
    function renumberAuthors() {
        author_list.children(".author").each(function(i, el) {
            $(this).find(".position input").val(i);
        });
        if ($(".author:visible").length > 1) {
            author_list.sortable("enable");
            $(".author .remove").show();
            $(".author .handle").css('visibility','visible');
        } else {
            author_list.sortable("disable");
            $(".author .remove").hide();
            $(".author .handle").css('visibility','hidden');
        }
    }
    function addAuthorRow() {
        var numForms = author_list.children(".author").length;
        author_list.append(empty_form([numForms]))
                   .sortable("refresh");
        author_list.find(".blank .email-autocomplete")
                   .placeholder();
        manager.val(author_list.children(".author").length);
        renumberAuthors();
    }
    function validateUser(e) {
        var tgt = $(this),
            row = tgt.parents("li");
        if (row.hasClass("blank")) {
            tgt.removeClass("placeholder")
               .attr("placeholder", undefined);
            row.removeClass("blank")
               .addClass("author");
            addAuthorRow();
        }
        if (tgt.val().length > 2) {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(function () {
                tgt.addClass("ui-autocomplete-loading")
                   .removeClass("invalid")
                   .removeClass("valid");
                request = $.ajax({
                    url: tgt.attr("data-src"),
                    data: {q: tgt.val()},
                    success: function(data) {
                        tgt.removeClass("ui-autocomplete-loading")
                           .addClass("valid");
                    },
                    error: function() {
                        tgt.removeClass("ui-autocomplete-loading")
                           .addClass("invalid");
                    }
                });
            }, 500);
        }
    }
}


function initCompatibility() {
    $('p.add-app a').live('click', function(e) {
        e.preventDefault();
        var outer = $(this).closest('form');

        $('tr.app-extra', outer).each(function() {
            addAppRow(this);
        });

        $('.new-apps', outer).toggle();

        $('.new-apps ul').delegate('a', 'click', function(e) {
            e.preventDefault();
            var extraAppRow = $('tr.app-extra td[class=' + $(this).attr('class') + ']', outer);
            extraAppRow.parents('tr.app-extra').find('input:checkbox').removeAttr('checked')
                       .closest('tr').removeClass('app-extra');

            $(this).closest('li').remove();

            if (!$('tr.app-extra', outer).length)
                $('p.add-app', outer).hide();
        });
    });

    $('.compat-versions .remove').live('click', function(e) {
        e.preventDefault();
        var appRow = $(this).closest('tr');

        appRow.addClass('app-extra');

        if (!appRow.hasClass('app-extra-orig'))
            appRow.find('input:checkbox').attr('checked', true);

        $('p.add-app:hidden', $(this).closest('form')).show();
        addAppRow(appRow);
    });

    $('.compat-update-modal').modal('a.compat-update', {
        delegate: $('.item-actions li.compat, .compat-error-popup'),
        hideme: false,
        emptyme: true,
        callback: compatModalCallback
    });

    $('.compat-error-popup').popup('.compat-error', {
        width: '450px',
        callback: function(obj) {
            var $popup = this;
            $popup.delegate('.close, .compat-update', 'click', function(e) {
                e.preventDefault();
                $popup.hideMe();
            });
            return {pointTo: $(obj.click_target)};
        }
    });
}


function addAppRow(obj) {
    var outer = $(obj).closest('form'),
        appClass = $('td.app', obj).attr('class');
    if (!$('.new-apps ul', outer).length)
        $('.new-apps', outer).html('<ul></ul>');
    if ($('.new-apps ul a[class=' + appClass + ']', outer).length)
        return;
    var appLabel = $('td.app', obj).text(),
        appHTML = '<li><a href="#" class="' + appClass + '">' + appLabel + '</a></li>';
    $('.new-apps ul', outer).append(appHTML);
}


function compatModalCallback(obj) {
    var $widget = this,
        ct = $(obj.click_target),
        form_url = ct.attr('data-updateurl');

    if ($widget.hasClass('ajax-loading'))
        return;
    $widget.addClass('ajax-loading');

    $widget.load(form_url, function(e) {
        $widget.removeClass('ajax-loading');
    });

    $('form.compat-versions').live('submit', function(e) {
        e.preventDefault();
        $widget.empty();

        if ($widget.hasClass('ajax-loading'))
            return;
        $widget.addClass('ajax-loading');

        var widgetForm = $(this);
        $.post(widgetForm.attr('action'), widgetForm.serialize(), function(data) {
            $widget.removeClass('ajax-loading');
            if ($(data).find('.errorlist').length) {
                $widget.html(data);
            } else {
                var c = $('.item[data-addonid=' + widgetForm.attr('data-addonid') + '] .item-actions li.compat');
                c.load(c.attr('data-src'));
                $widget.hideMe();
            }
        });
    });

    return {pointTo: ct};
}
