package ar.gestorpenal.news;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

/** Manual posts: who writes them, who archives them, and what a post may contain. */
class FirmPostApiTests extends NewsApiTestSupport {

    @Test
    void shouldLetEveryMemberPostATrimmedText() throws Exception {
        postJson(paralegal, POSTS, "{\"body\": \"  Llegó la cédula de la causa ficticia  \"}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/news/posts/")))
                .andExpect(jsonPath("$.body").value("Llegó la cédula de la causa ficticia"))
                .andExpect(jsonPath("$.canArchive").value(true));
    }

    @Test
    void shouldRejectAnEmptyOrTooLongPost() throws Exception {
        postJson(lawyer, POSTS, "{\"body\": \"   \"}").andExpect(status().isBadRequest());
        postJson(lawyer, POSTS, "{}").andExpect(status().isBadRequest());
        postJson(lawyer, POSTS, "{\"body\": \"" + "a".repeat(1001) + "\"}").andExpect(status().isBadRequest());
        postJson(lawyer, POSTS, "{\"body\": \"" + "a".repeat(1000) + "\"}").andExpect(status().isCreated());
    }

    @Test
    void shouldLetOnlyTheAuthorOrTheOwnerArchiveAndRestoreAPost() throws Exception {
        String post = createPost(paralegal, "Aviso ficticio del procurador");

        getAs(owner, NEWS).andExpect(jsonPath("$.items[0].post.canArchive").value(true));
        getAs(lawyer, NEWS).andExpect(jsonPath("$.items[0].post.canArchive").value(false));
        postEmpty(lawyer, POSTS + "/" + post + "/archive").andExpect(status().isForbidden());
        postEmpty(paralegal, POSTS + "/" + post + "/archive").andExpect(status().isNoContent());
        postEmpty(paralegal, POSTS + "/" + post + "/archive").andExpect(status().isNoContent());
        postEmpty(lawyer, POSTS + "/" + post + "/restore").andExpect(status().isForbidden());
        postEmpty(owner, POSTS + "/" + post + "/restore").andExpect(status().isNoContent());
        getAs(lawyer, NEWS).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void shouldAnswerNotFoundForAnUnknownPost() throws Exception {
        postEmpty(owner, POSTS + "/00000000-0000-0000-0000-000000000001/archive").andExpect(status().isNotFound());
    }

    @Test
    void shouldRequireALoggedInUser() throws Exception {
        mockMvc.perform(get(NEWS))
                .andExpect(status().isUnauthorized());
    }
}
